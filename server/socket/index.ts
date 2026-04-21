/* Purpose: Socket.io signaling + realtime notifications server for Clario (runs separately from Next.js). */

import "./load-env";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import * as Sentry from "@sentry/node";
import * as notificationTypesModule from "../../lib/notification-types";
import * as loggerModule from "../../lib/logger";
import * as dbModule from "../../lib/db";

const notificationTypesCompat = notificationTypesModule as typeof notificationTypesModule & {
  default?: { NotificationTypes?: typeof notificationTypesModule.NotificationTypes };
};
const loggerCompat = loggerModule as typeof loggerModule & {
  default?: { logger?: typeof loggerModule.logger };
};
const dbCompat = dbModule as typeof dbModule & {
  default?: { db?: typeof dbModule.db; prisma?: typeof dbModule.prisma };
};

const NotificationTypes =
  notificationTypesCompat.NotificationTypes ??
  notificationTypesCompat.default?.NotificationTypes;
const logger = loggerCompat.logger ?? loggerCompat.default?.logger;
const db = dbCompat.db ?? dbCompat.prisma ?? dbCompat.default?.db ?? dbCompat.default?.prisma;

type JoinRoomPayload = { roomId: string; userId: string; role: "LEARNER" | "TEACHER" | "ADMIN" | string };
type OfferPayload = { roomId: string; offer: unknown; targetSocketId: string };
type AnswerPayload = { roomId: string; answer: unknown; targetSocketId: string };
type IcePayload = { roomId: string; candidate: unknown; targetSocketId: string };
type LeaveRoomPayload = { roomId: string };
type ChatPayload = { roomId: string; message: string; senderId: string; senderName: string; sessionId?: string };
type ChatJoinPayload = { roomIdentifier: string; userId: string; senderName: string };
type ChatSendPayload = { roomIdentifier: string; senderId: string; senderName: string; content: string };
type WebRtcOfferPayload = { roomIdentifier: string; offer: RTCSessionDescriptionInit };
type WebRtcAnswerPayload = { roomIdentifier: string; answer: RTCSessionDescriptionInit };
type WebRtcIcePayload = { roomIdentifier: string; candidate: RTCIceCandidateInit };
type WebRtcReadyPayload = { roomIdentifier: string };
type MediaStatePayload = {
  roomIdentifier: string;
  userId: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
};
type RoomPresencePayload = {
  participantCount: number;
  participantUserIds: string[];
  roomIdentifier: string;
};
type SessionLeavePayload = {
  roomIdentifier: string;
};
type LiveSessionEndPayload = {
  roomIdentifier: string;
  sessionId: string;
  endedByUserId?: string;
};
type RegisterPayload = { userId: string };
type LegacySessionEndPayload = {
  roomId: string;
  sessionId: string;
  teacherUserId?: string;
  learnerUserId?: string;
};

type NotifyBody = { userId: string; notification: unknown };

const PORT = Number(process.env.PORT ?? 4000);
const NEXT_INTERNAL_TRPC_URL =
  process.env.NEXT_INTERNAL_TRPC_URL ?? "http://localhost:3000/api/trpc";
const SENTRY_DSN = process.env.SENTRY_DSN;
const corsOrigin =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    : "*";

if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, environment: process.env.NODE_ENV });
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "OPTIONS"],
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

// roomId -> set of socketIds
const roomMap = new Map<string, Set<string>>();
// roomIdentifier -> socketId -> userId
const sessionRoomMembers = new Map<string, Map<string, string>>();
// socketId -> set of roomIdentifiers
const socketSessionRooms = new Map<string, Set<string>>();
// roomIdentifier -> userId -> media state
const roomMediaStates = new Map<
  string,
  Map<string, { userId: string; micEnabled: boolean; cameraEnabled: boolean }>
>();
// userId -> socketId (latest connection)
const userSocketMap = new Map<string, string>();
const metrics = {
  connectionsCurrent: 0,
  connectionsTotal: 0,
  sessionJoinsTotal: 0,
  sessionJoinSuccess: 0,
  callDropsTotal: 0,
};

function upsertRoomMember(roomId: string, socketId: string) {
  const set = roomMap.get(roomId) ?? new Set<string>();
  set.add(socketId);
  roomMap.set(roomId, set);
}

function removeRoomMember(roomId: string, socketId: string) {
  const set = roomMap.get(roomId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) roomMap.delete(roomId);
}

function getOtherSocketId(roomId: string, socketId: string) {
  const set = roomMap.get(roomId);
  if (!set) return null;
  for (const id of Array.from(set.values())) {
    if (id !== socketId) return id;
  }
  return null;
}

function joinSessionRoom(roomIdentifier: string, socketId: string, userId: string) {
  const roomUsers = sessionRoomMembers.get(roomIdentifier) ?? new Map<string, string>();
  roomUsers.set(socketId, userId);
  sessionRoomMembers.set(roomIdentifier, roomUsers);

  const memberships = socketSessionRooms.get(socketId) ?? new Set<string>();
  memberships.add(roomIdentifier);
  socketSessionRooms.set(socketId, memberships);
}

function leaveSessionRoom(roomIdentifier: string, socketId: string) {
  const roomUsers = sessionRoomMembers.get(roomIdentifier);
  const userId = roomUsers?.get(socketId);

  if (roomUsers) {
    roomUsers.delete(socketId);
    if (roomUsers.size === 0) {
      sessionRoomMembers.delete(roomIdentifier);
      roomMediaStates.delete(roomIdentifier);
    } else if (userId) {
      const mediaStates = roomMediaStates.get(roomIdentifier);
      mediaStates?.delete(userId);
      if (mediaStates && mediaStates.size === 0) {
        roomMediaStates.delete(roomIdentifier);
      }
    }
  }

  const memberships = socketSessionRooms.get(socketId);
  memberships?.delete(roomIdentifier);
  if (memberships && memberships.size === 0) {
    socketSessionRooms.delete(socketId);
  }

  return userId ?? null;
}

function getRoomMediaState(roomIdentifier: string) {
  return Array.from(roomMediaStates.get(roomIdentifier)?.values() ?? []);
}

function getRoomPresence(roomIdentifier: string): RoomPresencePayload {
  const roomUsers = sessionRoomMembers.get(roomIdentifier);
  const participantUserIds = Array.from(new Set(roomUsers?.values() ?? []));

  return {
    roomIdentifier,
    participantCount: participantUserIds.length,
    participantUserIds,
  };
}

function emitRoomPresence(roomIdentifier: string) {
  io.to(roomIdentifier).emit("room:presence", getRoomPresence(roomIdentifier));
}

async function persistChatMessage(payload: ChatPayload) {
  // Spec: make an HTTP call to Next.js tRPC endpoint to persist the message.
  // We call a tRPC procedure `messages.create` we will implement in Next.
  const body = {
    json: {
      roomId: payload.roomId,
      senderId: payload.senderId,
      content: payload.message,
    },
  };

  // tRPC v11 httpBatchLink usually uses /api/trpc/<path>, but direct POST to path works in Next adapter.
  const url = `${NEXT_INTERNAL_TRPC_URL}/messages.create`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

// HTTP endpoint for server-to-server notification delivery
app.get("/", (_req, res) => {
  res.redirect(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/notify", (req, res) => {
  const { userId, notification } = req.body as NotifyBody;
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  const socketId = userSocketMap.get(userId);
  if (!socketId) return res.json({ ok: true, delivered: false });
  io.to(socketId).emit("notification", notification);
  return res.json({ ok: true, delivered: true });
});

app.get("/metrics", (_req, res) => {
  res.json({
    socketConnectionsCurrent: metrics.connectionsCurrent,
    socketConnectionsTotal: metrics.connectionsTotal,
    sessionJoinsTotal: metrics.sessionJoinsTotal,
    sessionJoinSuccessRate:
      metrics.sessionJoinsTotal === 0
        ? 0
        : Number((metrics.sessionJoinSuccess / metrics.sessionJoinsTotal).toFixed(4)),
    callDropRate:
      metrics.sessionJoinsTotal === 0
        ? 0
        : Number((metrics.callDropsTotal / metrics.sessionJoinsTotal).toFixed(4)),
    callDropsTotal: metrics.callDropsTotal,
  });
});

io.on("connection", (socket) => {
  metrics.connectionsCurrent += 1;
  metrics.connectionsTotal += 1;
  logger.info("socket.connected", { socketId: socket.id, connectionsCurrent: metrics.connectionsCurrent });
  socket.on("register", (payload: RegisterPayload) => {
    if (!payload?.userId) return;
    userSocketMap.set(payload.userId, socket.id);
  });

  socket.on("join-room", (payload: JoinRoomPayload) => {
    if (!payload?.roomId) return;
    metrics.sessionJoinsTotal += 1;
    socket.join(payload.roomId);
    upsertRoomMember(payload.roomId, socket.id);

    const set = roomMap.get(payload.roomId);
    if (set && set.size >= 2) {
      const other = getOtherSocketId(payload.roomId, socket.id);
      if (other) {
        metrics.sessionJoinSuccess += 1;
        // Only the existing peer becomes the offerer.
        socket.to(other).emit("peer-joined", { socketId: socket.id });
      }
    }
  });

  socket.on("offer", (payload: OfferPayload) => {
    if (!payload?.targetSocketId) return;
    io.to(payload.targetSocketId).emit("offer", { offer: payload.offer, from: socket.id });
  });

  socket.on("answer", (payload: AnswerPayload) => {
    if (!payload?.targetSocketId) return;
    io.to(payload.targetSocketId).emit("answer", { answer: payload.answer, from: socket.id });
  });

  socket.on("ice-candidate", (payload: IcePayload) => {
    if (!payload?.targetSocketId) return;
    io.to(payload.targetSocketId).emit("ice-candidate", { candidate: payload.candidate, from: socket.id });
  });

  socket.on("leave-room", (payload: LeaveRoomPayload) => {
    if (!payload?.roomId) return;
    socket.leave(payload.roomId);
    removeRoomMember(payload.roomId, socket.id);
    socket.to(payload.roomId).emit("peer-left", { socketId: socket.id });
  });

  socket.on("chat-message", async (payload: ChatPayload) => {
    if (!payload?.roomId || !payload?.message) return;
    socket.to(payload.roomId).emit("chat-message", {
      roomId: payload.roomId,
      message: payload.message,
      senderId: payload.senderId,
      senderName: payload.senderName,
      createdAt: new Date().toISOString(),
    });
    await persistChatMessage(payload);
  });

  socket.on("chat:join", async ({ roomIdentifier, userId }: ChatJoinPayload) => {
    if (!roomIdentifier || !userId) return;

    try {
      socket.join(roomIdentifier);
      joinSessionRoom(roomIdentifier, socket.id, userId);
      const messages = await db.message.findMany({
        where: { session: { roomIdentifier } },
        orderBy: { createdAt: "asc" },
        take: 50,
      });

      socket.emit("chat:history", messages);
      socket.emit("media:sync", getRoomMediaState(roomIdentifier));
      emitRoomPresence(roomIdentifier);
    } catch (error) {
      logger.error("chat.join.failed", {
        socketId: socket.id,
        roomIdentifier,
        error: String(error),
      });
    }
  });

  socket.on("chat:send", async ({ roomIdentifier, senderId, senderName, content }: ChatSendPayload) => {
    if (!roomIdentifier || !senderId || !content?.trim()) return;

    try {
      const session = await db.session.findUnique({ where: { roomIdentifier } });
      if (!session) return;

      const message = await db.message.create({
        data: {
          sessionId: session.id,
          senderId,
          senderName: senderName?.trim() ?? "",
          content: content.trim(),
        },
      });

      io.to(roomIdentifier).emit("chat:message", message);
    } catch (error) {
      logger.error("chat.send.failed", {
        socketId: socket.id,
        roomIdentifier,
        senderId,
        error: String(error),
      });
    }
  });

  socket.on("webrtc:ready", ({ roomIdentifier }: WebRtcReadyPayload) => {
    if (!roomIdentifier) return;
    socket.to(roomIdentifier).emit("webrtc:peer-ready");
  });

  socket.on("webrtc:offer", ({ roomIdentifier, offer }: WebRtcOfferPayload) => {
    if (!roomIdentifier || !offer) return;
    socket.to(roomIdentifier).emit("webrtc:offer", { offer });
  });

  socket.on("webrtc:answer", ({ roomIdentifier, answer }: WebRtcAnswerPayload) => {
    if (!roomIdentifier || !answer) return;
    socket.to(roomIdentifier).emit("webrtc:answer", { answer });
  });

  socket.on("webrtc:ice", ({ roomIdentifier, candidate }: WebRtcIcePayload) => {
    if (!roomIdentifier || !candidate) return;
    socket.to(roomIdentifier).emit("webrtc:ice", { candidate });
  });

  socket.on("media:state", ({ roomIdentifier, userId, micEnabled, cameraEnabled }: MediaStatePayload) => {
    if (!roomIdentifier || !userId) return;

    const mediaStates = roomMediaStates.get(roomIdentifier) ?? new Map();
    mediaStates.set(userId, {
      userId,
      micEnabled,
      cameraEnabled,
    });
    roomMediaStates.set(roomIdentifier, mediaStates);

    socket.to(roomIdentifier).emit("media:state", {
      userId,
      micEnabled,
      cameraEnabled,
    });
  });

  socket.on("session:leave", ({ roomIdentifier }: SessionLeavePayload) => {
    if (!roomIdentifier) return;

    const userId = leaveSessionRoom(roomIdentifier, socket.id);
    socket.leave(roomIdentifier);
    emitRoomPresence(roomIdentifier);
    socket.to(roomIdentifier).emit("peer:left", { userId });
  });

  socket.on("session:end", ({ roomIdentifier, sessionId, endedByUserId }: LiveSessionEndPayload) => {
    if (!roomIdentifier || !sessionId) return;

    io.to(roomIdentifier).emit("session:ended", {
      sessionId,
      endedByUserId: endedByUserId ?? null,
    });

    const roomUsers = sessionRoomMembers.get(roomIdentifier);
    if (roomUsers) {
      for (const socketId of Array.from(roomUsers.keys())) {
        io.sockets.sockets.get(socketId)?.leave(roomIdentifier);
        const memberships = socketSessionRooms.get(socketId);
        memberships?.delete(roomIdentifier);
        if (memberships && memberships.size === 0) {
          socketSessionRooms.delete(socketId);
        }
      }
    }

    sessionRoomMembers.delete(roomIdentifier);
    roomMediaStates.delete(roomIdentifier);
  });

  socket.on("whiteboard-draw", (payload) => {
    if (!payload?.roomId) return;
    socket.to(payload.roomId).emit("whiteboard-draw", payload);
  });

  socket.on("whiteboard-clear", (payload) => {
    if (!payload?.roomId) return;
    socket.to(payload.roomId).emit("whiteboard-clear", payload);
  });

  socket.on("whiteboard-active", (payload) => {
    if (!payload?.roomId) return;
    socket.to(payload.roomId).emit("whiteboard-active", payload);
  });

  socket.on("request-snapshot", (payload) => {
    if (!payload?.roomId) return;
    // Broadcast requested snapshot ping to room so a peer can answer
    socket.to(payload.roomId).emit("request-snapshot", { ...payload, targetSocketId: socket.id });
  });

  socket.on("canvas-snapshot", (payload) => {
    if (!payload?.roomId) return;
    if (payload.targetSocketId) {
      io.to(payload.targetSocketId).emit("canvas-snapshot", payload);
    } else {
      socket.to(payload.roomId).emit("canvas-snapshot", payload);
    }
  });

  socket.on("session-end", ({ roomId, sessionId, teacherUserId, learnerUserId }: LegacySessionEndPayload) => {
    if (!roomId) return;
    io.to(roomId).emit("session-ended", { roomId, sessionId });
    const notification = {
      type: NotificationTypes.SESSION_COMPLETE,
      title: "Session complete",
      message: "This session ended successfully.",
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    if (teacherUserId && userSocketMap.get(teacherUserId)) {
      io.to(userSocketMap.get(teacherUserId) as string).emit("notification", notification);
    }
    if (learnerUserId && userSocketMap.get(learnerUserId)) {
      io.to(userSocketMap.get(learnerUserId) as string).emit("notification", notification);
    }
    roomMap.delete(roomId);
  });

  socket.on("disconnect", () => {
    metrics.connectionsCurrent = Math.max(0, metrics.connectionsCurrent - 1);
    // cleanup userSocketMap entries pointing to this socket
    for (const [userId, sockId] of Array.from(userSocketMap.entries())) {
      if (sockId === socket.id) userSocketMap.delete(userId);
    }
    // notify live session rooms that this participant left
    for (const roomIdentifier of Array.from(socketSessionRooms.get(socket.id) ?? [])) {
      const userId = leaveSessionRoom(roomIdentifier, socket.id);
      emitRoomPresence(roomIdentifier);
      socket.to(roomIdentifier).emit("peer:left", { userId });
    }
    // best-effort cleanup of rooms
    for (const [roomId, set] of Array.from(roomMap.entries())) {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        metrics.callDropsTotal += 1;
        socket.to(roomId).emit("peer-left", { socketId: socket.id });
        if (set.size === 0) roomMap.delete(roomId);
      }
    }
    logger.info("socket.disconnected", { socketId: socket.id, connectionsCurrent: metrics.connectionsCurrent });
  });
});

server.listen(PORT, () => {
  logger.info("socket.server.started", { port: PORT });
});

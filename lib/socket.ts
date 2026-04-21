"use client";

import PusherClient, { type Members, type PresenceChannel } from "pusher-js";
import { io, type Socket } from "socket.io-client";
import { getRealtimeConfig } from "@/lib/realtime-client";
import { getRealtimeChannelName } from "@/lib/realtime-channel";

export type SocketParticipantRole = "TEACHER" | "LEARNER" | "ADMIN";

export type JoinRoomPayload = {
  roomId: string;
  role: SocketParticipantRole;
  userId: string;
};

export type SessionChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
};

export type SessionParticipantMediaState = {
  userId: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
};

export type SessionRoomPresence = {
  roomIdentifier: string;
  participantCount: number;
  participantUserIds: string[];
};

export type WhiteboardStroke = {
  id: string;
  points: {x: number, y: number}[];
  color: string;
  width: number;
};

export type SharedResource = {
  id: string;
  url: string;
  title: string;
  addedBy: string;
};

type SessionEventPayloadMap = {
  "chat:history": SessionChatMessage[];
  "chat:message": SessionChatMessage;
  "webrtc:offer": { offer: RTCSessionDescriptionInit };
  "webrtc:answer": { answer: RTCSessionDescriptionInit };
  "webrtc:ice": { candidate: RTCIceCandidateInit };
  "webrtc:peer-ready": undefined;
  "media:sync": SessionParticipantMediaState[];
  "media:state": SessionParticipantMediaState;
  "room:presence": SessionRoomPresence;
  "peer:left": { userId?: string | null };
  "session:ended": { sessionId: string; endedByUserId?: string | null };
  "whiteboard:draw": WhiteboardStroke[];
  "whiteboard:clear": undefined;
  "whiteboard:state": { isActive: boolean; isLocked: boolean };
  "notes:sync": { content: string };
  "resource:share": SharedResource;
  "screen:state": { userId: string, isSharing: boolean };
};

type SessionOutboundEvent =
  | "webrtc:offer"
  | "webrtc:answer"
  | "webrtc:ice"
  | "webrtc:ready"
  | "media:state"
  | "session:end"
  | "session:leave"
  | "whiteboard:draw"
  | "whiteboard:clear"
  | "whiteboard:state"
  | "notes:sync"
  | "resource:share"
  | "screen:state";

export type SessionRoomBindings = {
  onConnect?: () => void;
  onConnectError?: () => void;
  onDisconnect?: () => void;
  onJoined?: () => void;
  onEvent?: <TEvent extends keyof SessionEventPayloadMap>(
    event: TEvent,
    payload: SessionEventPayloadMap[TEvent]
  ) => void;
};

type SocketSingleton = {
  client: Socket;
  kind: "socket";
};

type PusherSingleton = {
  client: PusherClient;
  kind: "pusher";
};

export type RealtimeSingleton = SocketSingleton | PusherSingleton;
export type SignalingSocket = Socket;

export type SessionRoomConnection = {
  kind: "socket" | "pusher";
  disconnect: () => void;
  emit: (event: SessionOutboundEvent, payload?: Record<string, unknown>) => Promise<void>;
  sendChat: (payload: {
    content: string;
    roomIdentifier: string;
    senderId: string;
    senderName: string;
  }) => Promise<void>;
};

let socketSingleton: Socket | null = null;
let socketPromise: Promise<Socket> | null = null;
const joinedSocketRooms = new Set<string>();
let pusherSingleton:
  | {
      client: PusherClient;
      cluster: string;
      key: string;
    }
  | null = null;

function logSocket(event: string, meta: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return;
  }

  // eslint-disable-next-line no-console
  console.info("[socket-runtime]", {
    event,
    ...meta,
  });
}

function normalizeMemberIds(members: Members): string[] {
  return Object.keys(members.members ?? {});
}

function buildPresencePayload(
  roomIdentifier: string,
  memberIds: string[]
): SessionRoomPresence {
  return {
    roomIdentifier,
    participantCount: memberIds.length,
    participantUserIds: memberIds,
  };
}

function createSocketClient(socketUrl: string) {
  const socket = io(socketUrl, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    logSocket("connect", {
      socketId: socket.id ?? null,
    });
  });

  socket.on("disconnect", (reason) => {
    logSocket("disconnect", {
      reason,
    });
  });

  socket.on("connect_error", (error) => {
    logSocket("connect_error", {
      message: error.message,
    });
  });

  socket.connect();
  return socket;
}

function createPusherClient(key: string, cluster: string) {
  return new PusherClient(key, {
    cluster,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });
}

export async function getSingleton(): Promise<RealtimeSingleton> {
  if (typeof window === "undefined") {
    throw new Error("Realtime clients can only be used in the browser.");
  }

  const config = await getRealtimeConfig();

  if (config.socketUrl) {
    if (socketSingleton) {
      if (!socketSingleton.connected && !socketSingleton.active) {
        socketSingleton.connect();
      }

      return {
        kind: "socket",
        client: socketSingleton,
      };
    }

    if (!socketPromise) {
      socketPromise = Promise.resolve(createSocketClient(config.socketUrl)).finally(
        () => {
          socketPromise = null;
        }
      );
    }

    socketSingleton = await socketPromise;
    return {
      kind: "socket",
      client: socketSingleton,
    };
  }

  if (!config.pusherKey || !config.pusherCluster) {
    throw new Error(
      "Realtime configuration is unavailable. Configure Pusher or NEXT_PUBLIC_SOCKET_URL."
    );
  }

  if (
    pusherSingleton &&
    pusherSingleton.key === config.pusherKey &&
    pusherSingleton.cluster === config.pusherCluster
  ) {
    return {
      kind: "pusher",
      client: pusherSingleton.client,
    };
  }

  pusherSingleton?.client.disconnect();
  const client = createPusherClient(config.pusherKey, config.pusherCluster);
  pusherSingleton = {
    client,
    key: config.pusherKey,
    cluster: config.pusherCluster,
  };

  return {
    kind: "pusher",
    client,
  };
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  keepalive = false
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    keepalive,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return response;
}

function bindSocketRoom(
  socket: Socket,
  roomIdentifier: string,
  userId: string,
  senderName: string,
  bindings: SessionRoomBindings
) {
  const handleConnect = () => {
    bindings.onConnect?.();
    socket.emit("chat:join", {
      roomIdentifier,
      userId,
      senderName,
    });
  };

  const handleConnectError = () => {
    bindings.onConnectError?.();
  };

  const handleDisconnect = () => {
    bindings.onDisconnect?.();
  };

  const handleChatHistory = (payload: SessionChatMessage[]) => {
    bindings.onJoined?.();
    bindings.onEvent?.("chat:history", payload);
  };

  const handleChatMessage = (payload: SessionChatMessage) => {
    bindings.onEvent?.("chat:message", payload);
  };

  const handlePeerReady = () => {
    bindings.onEvent?.("webrtc:peer-ready", undefined);
  };

  const handleOffer = (payload: { offer: RTCSessionDescriptionInit }) => {
    bindings.onEvent?.("webrtc:offer", payload);
  };

  const handleAnswer = (payload: { answer: RTCSessionDescriptionInit }) => {
    bindings.onEvent?.("webrtc:answer", payload);
  };

  const handleIce = (payload: { candidate: RTCIceCandidateInit }) => {
    bindings.onEvent?.("webrtc:ice", payload);
  };

  const handleMediaSync = (payload: SessionParticipantMediaState[]) => {
    bindings.onEvent?.("media:sync", payload);
  };

  const handleMediaState = (payload: SessionParticipantMediaState) => {
    bindings.onEvent?.("media:state", payload);
  };

  const handleRoomPresence = (payload: SessionRoomPresence) => {
    bindings.onEvent?.("room:presence", payload);
  };

  const handlePeerLeft = (payload: { userId?: string | null }) => {
    bindings.onEvent?.("peer:left", payload);
  };

  const handleSessionEnded = (payload: {
    sessionId: string;
    endedByUserId?: string | null;
  }) => {
    bindings.onEvent?.("session:ended", payload);
  };

  const handleWhiteboardDraw = (payload: WhiteboardStroke[]) => bindings.onEvent?.("whiteboard:draw", payload);
  const handleWhiteboardClear = () => bindings.onEvent?.("whiteboard:clear", undefined);
  const handleWhiteboardState = (payload: { isActive: boolean; isLocked: boolean }) => bindings.onEvent?.("whiteboard:state", payload);
  const handleNotesSync = (payload: { content: string }) => bindings.onEvent?.("notes:sync", payload);
  const handleResourceShare = (payload: SharedResource) => bindings.onEvent?.("resource:share", payload);
  const handleScreenState = (payload: { userId: string, isSharing: boolean }) => bindings.onEvent?.("screen:state", payload);

  socket.on("connect", handleConnect);
  socket.on("connect_error", handleConnectError);
  socket.on("disconnect", handleDisconnect);
  socket.on("chat:history", handleChatHistory);
  socket.on("chat:message", handleChatMessage);
  socket.on("webrtc:peer-ready", handlePeerReady);
  socket.on("webrtc:offer", handleOffer);
  socket.on("webrtc:answer", handleAnswer);
  socket.on("webrtc:ice", handleIce);
  socket.on("media:sync", handleMediaSync);
  socket.on("media:state", handleMediaState);
  socket.on("room:presence", handleRoomPresence);
  socket.on("peer:left", handlePeerLeft);
  socket.on("session:ended", handleSessionEnded);
  socket.on("whiteboard:draw", handleWhiteboardDraw);
  socket.on("whiteboard:clear", handleWhiteboardClear);
  socket.on("whiteboard:state", handleWhiteboardState);
  socket.on("notes:sync", handleNotesSync);
  socket.on("resource:share", handleResourceShare);
  socket.on("screen:state", handleScreenState);

  if (socket.connected) {
    handleConnect();
  }

  return () => {
    socket.off("connect", handleConnect);
    socket.off("connect_error", handleConnectError);
    socket.off("disconnect", handleDisconnect);
    socket.off("chat:history", handleChatHistory);
    socket.off("chat:message", handleChatMessage);
    socket.off("webrtc:peer-ready", handlePeerReady);
    socket.off("webrtc:offer", handleOffer);
    socket.off("webrtc:answer", handleAnswer);
    socket.off("webrtc:ice", handleIce);
    socket.off("media:sync", handleMediaSync);
    socket.off("media:state", handleMediaState);
    socket.off("room:presence", handleRoomPresence);
    socket.off("peer:left", handlePeerLeft);
    socket.off("session:ended", handleSessionEnded);
    socket.off("whiteboard:draw", handleWhiteboardDraw);
    socket.off("whiteboard:clear", handleWhiteboardClear);
    socket.off("whiteboard:state", handleWhiteboardState);
    socket.off("notes:sync", handleNotesSync);
    socket.off("resource:share", handleResourceShare);
    socket.off("screen:state", handleScreenState);
  };
}

const pusherChannelRefs = new Map<string, number>();

function bindPusherRoom(
  pusher: PusherClient,
  roomIdentifier: string,
  bindings: SessionRoomBindings
) {
  const channelName = getRealtimeChannelName(roomIdentifier);
  
  const currentRefs = pusherChannelRefs.get(channelName) ?? 0;
  pusherChannelRefs.set(channelName, currentRefs + 1);

  const channel = pusher.subscribe(channelName) as PresenceChannel;

  const emitPresence = (members: Members) => {
    bindings.onEvent?.(
      "room:presence",
      buildPresencePayload(roomIdentifier, normalizeMemberIds(members))
    );
  };

  const handleConnected = () => {
    bindings.onConnect?.();
  };

  const handleDisconnected = () => {
    bindings.onDisconnect?.();
  };

  const handleError = () => {
    bindings.onConnectError?.();
  };

  const handleSubscribed = (members: Members) => {
    bindings.onJoined?.();
    bindings.onEvent?.("media:sync", []);
    emitPresence(members);
  };

  const handleMemberAdded = () => {
    if (channel.members) {
      emitPresence(channel.members);
    }
  };

  const handleMemberRemoved = (member: { id: string }) => {
    if (channel.members) {
      emitPresence(channel.members);
    }
    bindings.onEvent?.("peer:left", { userId: member.id });
  };

  const handleChatMessage = (payload: SessionChatMessage) => {
    bindings.onEvent?.("chat:message", payload);
  };

  const handlePeerReady = () => {
    bindings.onEvent?.("webrtc:peer-ready", undefined);
  };

  const handleOffer = (payload: { offer: RTCSessionDescriptionInit }) => {
    bindings.onEvent?.("webrtc:offer", payload);
  };

  const handleAnswer = (payload: { answer: RTCSessionDescriptionInit }) => {
    bindings.onEvent?.("webrtc:answer", payload);
  };

  const handleIce = (payload: { candidate: RTCIceCandidateInit }) => {
    bindings.onEvent?.("webrtc:ice", payload);
  };

  const handleMediaState = (payload: SessionParticipantMediaState) => {
    bindings.onEvent?.("media:state", payload);
  };

  const handleSessionEnded = (payload: {
    sessionId: string;
    endedByUserId?: string | null;
  }) => {
    bindings.onEvent?.("session:ended", payload);
  };

  const handleWhiteboardDraw = (payload: WhiteboardStroke[]) => bindings.onEvent?.("whiteboard:draw", payload);
  const handleWhiteboardClear = () => bindings.onEvent?.("whiteboard:clear", undefined);
  const handleWhiteboardState = (payload: { isActive: boolean; isLocked: boolean }) => bindings.onEvent?.("whiteboard:state", payload);
  const handleNotesSync = (payload: { content: string }) => bindings.onEvent?.("notes:sync", payload);
  const handleResourceShare = (payload: SharedResource) => bindings.onEvent?.("resource:share", payload);
  const handleScreenState = (payload: { userId: string, isSharing: boolean }) => bindings.onEvent?.("screen:state", payload);

  pusher.connection.bind("connected", handleConnected);
  pusher.connection.bind("disconnected", handleDisconnected);
  pusher.connection.bind("error", handleError);
  channel.bind("pusher:subscription_succeeded", handleSubscribed);
  channel.bind("pusher:member_added", handleMemberAdded);
  channel.bind("pusher:member_removed", handleMemberRemoved);
  channel.bind("chat:message", handleChatMessage);
  channel.bind("webrtc:peer-ready", handlePeerReady);
  channel.bind("webrtc:offer", handleOffer);
  channel.bind("webrtc:answer", handleAnswer);
  channel.bind("webrtc:ice", handleIce);
  channel.bind("media:state", handleMediaState);
  channel.bind("session:ended", handleSessionEnded);
  channel.bind("whiteboard:draw", handleWhiteboardDraw);
  channel.bind("whiteboard:clear", handleWhiteboardClear);
  channel.bind("whiteboard:state", handleWhiteboardState);
  channel.bind("notes:sync", handleNotesSync);
  channel.bind("resource:share", handleResourceShare);
  channel.bind("screen:state", handleScreenState);

  setTimeout(() => {
    if (pusher.connection.state === "connected") {
      handleConnected();
    }
    if (channel.subscribed) {
      handleSubscribed(channel.members as Members);
    }
  }, 0);

  return () => {
    pusher.connection.unbind("connected", handleConnected);
    pusher.connection.unbind("disconnected", handleDisconnected);
    pusher.connection.unbind("error", handleError);
    channel.unbind("pusher:subscription_succeeded", handleSubscribed);
    channel.unbind("pusher:member_added", handleMemberAdded);
    channel.unbind("pusher:member_removed", handleMemberRemoved);
    channel.unbind("chat:message", handleChatMessage);
    channel.unbind("webrtc:peer-ready", handlePeerReady);
    channel.unbind("webrtc:offer", handleOffer);
    channel.unbind("webrtc:answer", handleAnswer);
    channel.unbind("webrtc:ice", handleIce);
    channel.unbind("media:state", handleMediaState);
    channel.unbind("session:ended", handleSessionEnded);
    channel.unbind("whiteboard:draw", handleWhiteboardDraw);
    channel.unbind("whiteboard:clear", handleWhiteboardClear);
    channel.unbind("whiteboard:state", handleWhiteboardState);
    channel.unbind("notes:sync", handleNotesSync);
    channel.unbind("resource:share", handleResourceShare);
    channel.unbind("screen:state", handleScreenState);
    
    // Only unsubscribe if all listeners are completely disconnected (Strict mode bypass)
    // Delay slightly so that fast strict mode remounts can reuse the channel properly
    setTimeout(() => {
      const refs = (pusherChannelRefs.get(channelName) ?? 1) - 1;
      if (refs <= 0) {
        pusherChannelRefs.delete(channelName);
        pusher.unsubscribe(channelName);
      } else {
        pusherChannelRefs.set(channelName, refs);
      }
    }, 100);
  };
}

export async function connectSessionRoom(options: {
  bindings: SessionRoomBindings;
  roomIdentifier: string;
  userId: string;
  senderName: string;
}): Promise<SessionRoomConnection> {
  const singleton = await getSingleton();
  const { bindings, roomIdentifier, senderName, userId } = options;

  if (singleton.kind === "socket") {
    const socket = singleton.client;
    const unbind = bindSocketRoom(
      socket,
      roomIdentifier,
      userId,
      senderName,
      bindings
    );

    return {
      kind: "socket",
      disconnect: () => {
        unbind();
        if (socket.connected) {
          socket.emit("session:leave", {
            roomIdentifier,
          });
        }
      },
      emit: async (event, payload = {}) => {
        socket.emit(event, {
          roomIdentifier,
          ...payload,
        });
      },
      sendChat: async (payload) => {
        socket.emit("chat:send", payload);
      },
    };
  }

  const pusher = singleton.client;
  const unbind = bindPusherRoom(pusher, roomIdentifier, bindings);

  return {
    kind: "pusher",
    disconnect: () => {
      unbind();
    },
    emit: async (event, payload = {}) => {
      if (event === "session:leave") {
        return;
      }

      const translatedEvent =
        event === "webrtc:ready"
          ? "webrtc:peer-ready"
          : event === "session:end"
            ? "session:ended"
            : event;

      await postJson("/api/signaling", {
        event: translatedEvent,
        payload,
        roomIdentifier,
      }, event === "session:end");
    },
    sendChat: async (payload) => {
      await postJson("/api/chat/send", payload);
    },
  };
}

export async function getSocketClient(): Promise<SignalingSocket> {
  const singleton = await getSingleton();

  if (singleton.kind !== "socket") {
    throw new Error(
      "Socket.io client is unavailable. Set NEXT_PUBLIC_SOCKET_URL for local socket dev."
    );
  }

  return singleton.client;
}

export async function joinSocketRoom(payload: JoinRoomPayload) {
  if (!payload.roomId.trim()) {
    throw new Error("roomId is required to join a socket room.");
  }

  if (!payload.userId.trim()) {
    throw new Error("userId is required to join a socket room.");
  }

  const socket = await getSocketClient();
  joinedSocketRooms.add(payload.roomId.trim());

  socket.emit("join-room", payload);
  return socket;
}

export async function leaveSocketRoom(roomId: string) {
  const normalizedRoomId = roomId.trim();

  if (!normalizedRoomId) {
    return;
  }

  joinedSocketRooms.delete(normalizedRoomId);

  const socket = await getSocketClient().catch(() => null);
  if (!socket?.connected) {
    return;
  }

  socket.emit("leave-room", {
    roomId: normalizedRoomId,
  });
}

export function disconnectSocketClientIfIdle() {
  if (!socketSingleton || joinedSocketRooms.size > 0) {
    return;
  }

  socketSingleton.disconnect();
}

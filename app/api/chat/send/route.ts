import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hasPusherServerConfig, pusherServer } from "@/lib/pusher-server";
import { getRealtimeChannelName } from "@/lib/realtime-channel";

export const dynamic = "force-dynamic";

type ChatSendBody = {
  content?: string;
  roomIdentifier?: string;
  senderId?: string;
  senderName?: string;
};

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPusherServerConfig || !pusherServer) {
      return NextResponse.json(
        { error: "Pusher chat is not configured." },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => null)) as ChatSendBody | null;
    const roomIdentifier = body?.roomIdentifier?.trim();
    const senderId = body?.senderId?.trim();
    const senderName = body?.senderName?.trim() ?? "";
    const content = body?.content?.trim();

    if (!roomIdentifier || !senderId || !content) {
      return NextResponse.json(
        { error: "roomIdentifier, senderId, and content are required." },
        { status: 400 }
      );
    }

    if (senderId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const session = await db.session.findUnique({
      where: { roomIdentifier },
      include: {
        booking: {
          include: {
            learner: true,
            teacher: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isParticipant =
      session.booking.teacher.userId === user.id ||
      session.booking.learner.userId === user.id;

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const message = await db.message.create({
      data: {
        content,
        senderId: user.id,
        senderName,
        sessionId: session.id,
      },
    });

    await pusherServer.trigger(
      getRealtimeChannelName(roomIdentifier),
      "chat:message",
      message
    );

    return NextResponse.json(message);
  } catch (error) {
    logger.error("chat.send.failed", {
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

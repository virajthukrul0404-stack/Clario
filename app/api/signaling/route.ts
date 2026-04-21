import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hasPusherServerConfig, pusherServer } from "@/lib/pusher-server";
import { getRealtimeChannelName } from "@/lib/realtime-channel";

export const dynamic = "force-dynamic";

type SignalingBody = {
  event?: string;
  payload?: Record<string, unknown>;
  roomIdentifier?: string;
};

async function findAuthorizedSession(roomIdentifier: string, userId: string) {
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
    return { session: null, status: 404 as const };
  }

  const isParticipant =
    session.booking.teacher.userId === userId ||
    session.booking.learner.userId === userId;

  return {
    session: isParticipant ? session : null,
    status: isParticipant ? 200 : (403 as const),
  };
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPusherServerConfig || !pusherServer) {
      return NextResponse.json(
        { error: "Pusher signaling is not configured." },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => null)) as SignalingBody | null;
    const roomIdentifier = body?.roomIdentifier?.trim();
    const event = body?.event?.trim();

    if (!roomIdentifier || !event) {
      return NextResponse.json(
        { error: "roomIdentifier and event are required." },
        { status: 400 }
      );
    }

    const authorized = await findAuthorizedSession(roomIdentifier, user.id);
    if (!authorized.session) {
      return NextResponse.json(
        { error: authorized.status === 404 ? "Not found" : "Forbidden" },
        { status: authorized.status }
      );
    }

    await pusherServer.trigger(
      getRealtimeChannelName(roomIdentifier),
      event,
      body?.payload ?? {}
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("signaling.post.failed", {
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

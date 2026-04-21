import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hasPusherServerConfig, pusherServer } from "@/lib/pusher-server";
import { getRoomIdentifierFromChannelName } from "@/lib/realtime-channel";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPusherServerConfig || !pusherServer) {
      return NextResponse.json(
        { error: "Pusher auth is not configured." },
        { status: 503 }
      );
    }

    const form = await req.formData().catch(() => null);
    const socketId = form?.get("socket_id")?.toString().trim();
    const channelName = form?.get("channel_name")?.toString().trim();
    const roomIdentifier = channelName
      ? getRoomIdentifierFromChannelName(channelName)
      : null;

    if (!socketId || !channelName || !roomIdentifier) {
      return NextResponse.json(
        { error: "socket_id and channel_name are required." },
        { status: 400 }
      );
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

    const displayName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    const auth = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: user.id,
      user_info: {
        name: displayName || user.id,
      },
    });

    return NextResponse.json(auth);
  } catch (error) {
    logger.error("pusher.auth.failed", {
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

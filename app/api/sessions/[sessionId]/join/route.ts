import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";
import { findSessionByRouteParamWithInclude } from "@/lib/session-lookup";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await findSessionByRouteParamWithInclude(params.sessionId, {
      booking: {
        include: {
          teacher: { include: { user: true } },
          learner: { include: { user: true } },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isParticipant =
      user.id === session.booking.teacher.userId ||
      user.id === session.booking.learner.userId;

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const displayName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

    return NextResponse.json({
      roomIdentifier: session.roomIdentifier,
      displayName,
    });
  } catch (error) {
    logger.error("session.join.failed", {
      sessionId: params.sessionId,
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

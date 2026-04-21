import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { findSessionByRouteParamWithInclude } from "@/lib/session-lookup";

export const dynamic = "force-dynamic";

const sessionInclude = {
  booking: {
    include: {
      teacher: { include: { user: true } },
      learner: { include: { user: true } },
    },
  },
  messages: {
    orderBy: { createdAt: "asc" },
    take: 50,
  },
} as const;

function isValidSessionStatus(value: unknown): value is "WAITING" | "ACTIVE" | "ENDED" {
  return value === "WAITING" || value === "ACTIVE" || value === "ENDED";
}

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await findSessionByRouteParamWithInclude(
      params.sessionId,
      sessionInclude
    );

    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    logger.error("session.get.failed", {
      sessionId: params.sessionId,
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await findSessionByRouteParamWithInclude(
      params.sessionId,
      sessionInclude
    );

    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isParticipant =
      user.id === session.booking.teacher.userId ||
      user.id === session.booking.learner.userId;

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!isValidSessionStatus(body?.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updatedSession = await db.session.update({
      where: { id: session.id },
      data: {
        status: body.status,
        startedAt: body.status === "ACTIVE" ? new Date() : undefined,
        endedAt: body.status === "ENDED" ? new Date() : undefined,
      },
      include: sessionInclude,
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    logger.error("session.patch.failed", {
      sessionId: params.sessionId,
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

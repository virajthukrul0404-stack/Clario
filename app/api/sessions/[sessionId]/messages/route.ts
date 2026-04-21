import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { findSessionByRouteParam } from "@/lib/session-lookup";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await findSessionByRouteParam(params.sessionId);

    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = await db.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json(messages);
  } catch (error) {
    logger.error("session.messages.get.failed", {
      sessionId: params.sessionId,
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

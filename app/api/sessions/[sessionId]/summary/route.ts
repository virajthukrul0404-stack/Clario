import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Anthropic } from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { id: params.sessionId },
      include: {
        booking: {
          include: {
            teacher: { include: { user: true } },
            learner: { include: { user: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isParticipant =
      session.booking.teacher.userId === user.id ||
      session.booking.learner.userId === user.id;

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI summary is disabled because API key is missing." },
        { status: 503 }
      );
    }

    const { messages } = await req.json();

    const teacherName = `${session.booking.teacher.user.firstName} ${session.booking.teacher.user.lastName}`.trim() || "Teacher";
    const learnerName = `${session.booking.learner.user.firstName} ${session.booking.learner.user.lastName}`.trim() || "Learner";
    
    // Compile chat transcript
    const chatTranscript = messages.map((m: { senderName: string, content: string }) => `${m.senderName}: ${m.content}`).join("\n");

    const prompt = `Please summarize the following live session based on the chat transcript.\n\nTeacher: ${teacherName}\nLearner: ${learnerName}\n\nTranscript:\n${chatTranscript}\n\nProvide: A very brief executive summary of core topics discussed. Keep it tight and professional.`;

    const client = new Anthropic({ apiKey });
    const textResponse = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    let text = "";
    if (Array.isArray(textResponse.content)) {
      const block = textResponse.content.find((b) => "text" in b);
      if (block && "text" in block) {
        text = block.text;
      }
    }

    return NextResponse.json({ summary: text });
  } catch (error) {
    console.error("AI Summary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

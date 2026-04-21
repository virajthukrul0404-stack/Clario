export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const prompt = `You are an AI teaching assistant. 
  Summarize this tutoring session chat into:
  - Key topics discussed
  - Important points covered  
  - Action items for the student
  Be concise and structured.
  
  Chat messages:
  ${messages.join("\n")}`;
  
  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
      }),
    }
  );
  
  const data = await res.json();
  const summary = data.choices?.[0]?.message?.content ?? 
                  "Could not generate summary.";
  return Response.json({ summary });
}

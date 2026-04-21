export async function POST(req: Request) {
  const { message, history, sessionContext } = await req.json();

  const systemPrompt = `You are an AI teaching assistant 
  inside a live tutoring session on Clario. 
  You help students understand concepts, answer questions,
  and support the teacher. 
  Be concise, friendly, and educational.
  Session context: ${sessionContext ?? "Live tutoring session"}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message }
  ];

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
        messages,
        max_tokens: 1000,
      }),
    }
  );

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content
                ?? "Sorry, I could not respond right now.";
  return Response.json({ reply });
}

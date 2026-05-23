import { json, parseJson, withCors } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const body = await parseJson(event);
  const input = body.input;

  if (!input) {
    return json(400, { status: "error", message: "Input data is required." }, origin);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json(500, { status: "error", message: "GROQ_API_KEY is not set in environment." }, origin);
  }

  const prompt = {
    role: "user",
    content: `You are a professional Indian equities trading assistant.
Return ONLY one valid JSON object with this exact schema:
{
  "verdict": "BUY|SELL|HOLD",
  "confidence": number,
  "summary": string,
  "entry": number,
  "target": number,
  "stopLoss": number,
  "reasons": string[],
  "risks": string[],
  "newsImpact": string
}
Rules:
- If trendConsistency is "DIVERGENT", default to HOLD unless evidence is very strong.
- Only issue BUY/SELL if M1, M5 and M15 align with price vs VWAP direction.
- Keep confidence under 70 when alignment is weak.
- Keep reasons and risks concise and practical.
Input Data: ${JSON.stringify(input)}`
  };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [prompt]
      })
    });

    const groqData = await response.json();
    if (!response.ok) throw new Error(groqData.error?.message || "Groq API error");

    const content = groqData.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
    return json(200, { status: "success", data: parsed }, origin);
  } catch (error) {
    return json(500, { status: "error", message: error.message }, origin);
  }
});
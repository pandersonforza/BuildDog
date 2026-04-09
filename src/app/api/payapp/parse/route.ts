import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[payapp/parse] ANTHROPIC_API_KEY not set");
    return NextResponse.json({ error: "Anthropic API key not configured on server" }, { status: 500 });
  }

  let pdf: string;
  try {
    const body = await request.json() as { pdf?: string };
    if (!body.pdf || typeof body.pdf !== "string") {
      return NextResponse.json({ error: "Missing pdf field in request body" }, { status: 400 });
    }
    pdf = body.pdf;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  console.log("[payapp/parse] PDF base64 length:", pdf.length);

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf },
            },
            {
              type: "text",
              text: `You are a construction pay application (AIA G702/G703) parser.

Extract each line item from the Schedule of Values (G703 continuation sheet).
For each item return:
- description: the exact work description text
- amount: the GROSS "Work Completed This Period" dollar amount (column E). Do NOT subtract retainage — return the raw column E figure. Do NOT use column C (Scheduled Value) or column G (Total to Date).

Return ONLY valid JSON, no markdown fences:
{"items":[{"description":"string","amount":number}]}

Only include items where the This Period amount (column E) is greater than 0.
Amounts must be plain numbers with no $ or commas.
If no Schedule of Values is found, return {"items":[]}.`,
            },
          ],
        },
      ],
    });

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    console.log("[payapp/parse] Claude response:", rawText.slice(0, 300));

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let parsed: { items?: Array<{ description: string; amount: number }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[payapp/parse] JSON parse failed. Raw:", cleaned.slice(0, 300));
      return NextResponse.json({ error: `Claude returned non-JSON: ${cleaned.slice(0, 100)}` }, { status: 500 });
    }

    const items = (parsed.items ?? [])
      .filter((i) => i && typeof i.description === "string" && typeof i.amount === "number" && i.amount > 0)
      .map((i) => ({ description: i.description.trim(), amount: Math.round(i.amount * 100) / 100 }))
      .filter((i) => i.amount > 0);

    console.log("[payapp/parse] Returning", items.length, "items");
    return NextResponse.json({ items });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payapp/parse] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

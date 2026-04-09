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

STEP 1 — Find the retainage rate:
- Look on the G702 cover page for a retainage percentage (e.g. "10% retainage", "Retainage: 10%", or a line showing retainage as a % of work completed).
- If you find it, store it as a decimal (e.g. 10% → 0.10).
- If the G703 continuation sheet has a "Retainage" dollar column per line, use those figures instead.
- If no retainage information exists anywhere, use 0.

STEP 2 — Extract each Schedule of Values line item from the G703 continuation sheet:
- description: the exact work description text
- grossAmount: the "Work Completed This Period" or "This Period" dollar amount (column E). Do NOT use column C (Scheduled Value) or column G (Total to Date).
- amount: grossAmount × (1 − retainageRate), rounded to 2 decimal places.
  If the G703 has a per-line retainage dollar column, use: grossAmount − thatRetainageColumn instead.

Return ONLY valid JSON, no markdown fences:
{"retainageRate":0.10,"items":[{"description":"string","grossAmount":1000,"amount":900}]}

Only include items where grossAmount > 0.
All dollar values must be plain numbers (no $ or commas).
If no Schedule of Values is found, return {"retainageRate":0,"items":[]}.`,
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

    let parsed: { retainageRate?: number; items?: Array<{ description: string; grossAmount?: number; amount: number }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[payapp/parse] JSON parse failed. Raw:", cleaned.slice(0, 300));
      return NextResponse.json({ error: `Claude returned non-JSON: ${cleaned.slice(0, 100)}` }, { status: 500 });
    }

    console.log("[payapp/parse] Retainage rate:", parsed.retainageRate ?? 0);

    const items = (parsed.items ?? [])
      .filter((i) => i && typeof i.description === "string" && (i.grossAmount ?? i.amount) > 0)
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

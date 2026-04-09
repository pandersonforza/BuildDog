import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[api/payapp/parse] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  // Read PDF from multipart FormData
  let pdfBuffer: Buffer;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    pdfBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  const base64Pdf = pdfBuffer.toString("base64");
  const client = new Anthropic({ apiKey });

  console.log("[api/payapp/parse] PDF size:", pdfBuffer.length, "bytes");

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
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              type: "text",
              text: `You are a construction pay application (AIA G702/G703) parser.

Extract the Schedule of Values line items from this pay application PDF. For each line item, extract:
1. The description of the work
2. The "This Period" amount (column G or equivalent — the amount being billed in the current period, NOT the total scheduled value or contract amount)

Return ONLY a JSON object with this exact structure, no markdown fences, no explanation:
{"items":[{"description":"string","amount":number}]}

Rules:
- Only include items where the "This Period" amount is greater than 0
- Use the exact description from the Schedule of Values
- Amounts should be plain numbers (no $ or commas)
- If you cannot find a Schedule of Values or "This Period" column, return {"items":[]}`,
            },
          ],
        },
      ],
    });

    const rawText = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    // Strip markdown fences if present
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: { items: Array<{ description: string; amount: number }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[api/payapp/parse] Failed to parse Claude response:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "Claude returned invalid JSON" }, { status: 500 });
    }

    const items = (parsed.items ?? [])
      .filter(
        (item) =>
          item &&
          typeof item.description === "string" &&
          typeof item.amount === "number" &&
          item.amount > 0
      )
      .map((item) => ({ description: item.description.trim(), amount: item.amount }));

    console.log("[api/payapp/parse] Extracted", items.length, "items");

    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/payapp/parse] Anthropic API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

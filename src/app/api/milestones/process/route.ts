import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const maxDuration = 60;

interface ParsedMilestone {
  name: string;
  description: string | null;
  devFee: number;
  expectedDate: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Upload to Vercel Blob for processing
    const uniqueName = `dev-agreements/${Date.now()}-${file.name}`;
    const blob = await put(uniqueName, file, {
      access: "private",
      contentType: "application/pdf",
    });

    // Fetch the PDF back for AI processing
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const pdfRes = await fetch(blob.url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!pdfRes.ok) throw new Error("Failed to fetch uploaded PDF");
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const base64Pdf = pdfBuffer.toString("base64");

    const systemPrompt = `You are an expert at analyzing real estate development agreements. Your job is to extract milestone/fee schedules from development agreement PDFs.

Analyze the provided PDF and extract ALL milestones, fee installments, or payment schedule items. Look for:
- Development fee milestones and payment schedules
- Completion milestones with associated fees/payments
- Phase-based payment structures
- Any scheduled payments tied to project milestones or deliverables

Return ONLY valid JSON with no additional text or markdown formatting.

Required JSON structure:
{
  "milestones": [
    {
      "name": "string - milestone name or description (e.g. 'Site Acquisition', 'Construction Start', 'Certificate of Occupancy')",
      "description": "string or null - additional details about the milestone",
      "devFee": number - the dollar amount associated with this milestone (numeric, no currency symbols),
      "expectedDate": "string or null - expected date in YYYY-MM-DD format if mentioned"
    }
  ],
  "totalDevFee": number - the total development fee if stated in the agreement,
  "notes": "string - any important notes about the fee structure or payment terms"
}

Guidelines:
- Extract EVERY milestone or payment installment, even if the fee is $0
- If percentages are given instead of dollar amounts, calculate the dollar amount if the total fee is stated
- If dates are relative (e.g., "30 days after closing"), set expectedDate to null but include timing in description
- Preserve the order of milestones as they appear in the agreement
- If the document doesn't contain milestone/fee data, return an empty milestones array with a note explaining what was found`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
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
              text: systemPrompt,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response received from AI" },
        { status: 502 }
      );
    }

    let jsonText = textBlock.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let result: { milestones: ParsedMilestone[]; totalDevFee?: number; notes?: string };
    try {
      result = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse AI response:", jsonText);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      milestones: result.milestones || [],
      totalDevFee: result.totalDevFee || 0,
      notes: result.notes || "",
      fileUrl: blob.url,
    });
  } catch (error) {
    console.error("Failed to process dev agreement:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process agreement: ${message}` },
      { status: 500 }
    );
  }
}

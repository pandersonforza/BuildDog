import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

interface BudgetLineItemInput {
  description: string;
  originalBudget: number;
  revisedBudget: number;
}

interface BudgetCategoryInput {
  name: string;
  categoryGroup: string;
  lineItems: BudgetLineItemInput[];
}

interface AIBudgetResult {
  categories: BudgetCategoryInput[];
  notes: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: file and projectId' },
        { status: 400 }
      );
    }

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Convert all sheets to readable text for AI
    const sheetsData: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheetsData.push(`--- Sheet: "${sheetName}" ---\n${csv}`);
    }
    const spreadsheetText = sheetsData.join('\n\n');

    // Get project info for context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        address: true,
        budgetCategories: {
          select: {
            id: true,
            name: true,
            categoryGroup: true,
            lineItems: { select: { id: true, description: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. AI processing is required for budget import.' },
        { status: 500 }
      );
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are an expert real estate development budget analyst. You will be given spreadsheet data from a budget file. Your job is to analyze it and classify every line item into subcategories under the correct category group.

The budget is for a real estate development project called "${project.name}" located at "${project.address}".

There are exactly 5 category groups. Every subcategory MUST belong to one of these groups:
1. "Land" — subcategories: Acquisition, Due Diligence
2. "Soft Costs" — subcategories: Design Fees, Entitlements, Permits & Fees, Equipment, Signage
3. "Hard Costs" — subcategories: Construction, Site, Building Costs
4. "Outside Costs" — subcategories: Outside Costs
5. "Financing Costs" — subcategories: Loan Fees, Interest, Closing Costs

Rules:
- The "categoryGroup" MUST be one of exactly: "Land", "Soft Costs", "Hard Costs", "Outside Costs", "Financing Costs"
- The "name" is the subcategory name (e.g. "Building Costs", "Site", "Design Fees", "Construction", etc.)
- Use the EXACT subcategory names listed above. Do NOT create alternative names (e.g. use "Site" not "Site Costs", use "Construction" not "General Conditions").
- Place every line item under the most appropriate subcategory.
- Each line item needs a description and a budget amount.
- If the spreadsheet has both original and revised budgets, capture both. Otherwise set revisedBudget equal to originalBudget.
- Ignore totals/subtotal rows — only include individual line items.
- Ignore empty rows or rows that are clearly headers/labels without budget data.
- If amounts appear negative, convert them to positive.
- Parse dollar amounts correctly (remove $, commas, etc).
- Only include subcategories that have at least one line item.

Return ONLY valid JSON with no additional text or markdown formatting.

Required JSON structure:
{
  "categories": [
    {
      "name": "string - subcategory name (e.g. Building Costs, Design Fees, Loan Fees)",
      "categoryGroup": "string - MUST be one of: Hard Costs, Soft Costs, Financing, Land",
      "lineItems": [
        {
          "description": "string - line item description",
          "originalBudget": number,
          "revisedBudget": number
        }
      ]
    }
  ],
  "notes": "string - any observations about the data, warnings about unclear items, or items you excluded and why"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nHere is the spreadsheet data:\n\n${spreadsheetText}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No response received from AI' },
        { status: 502 }
      );
    }

    let jsonText = textBlock.text.trim();

    // Try multiple extraction strategies
    // 1. Code block extraction
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    // 2. Find the JSON object boundaries if not already clean
    if (!jsonText.startsWith('{')) {
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
      }
    }

    let result: AIBudgetResult;
    try {
      result = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('Failed to parse AI response. Raw text length:', textBlock.text.length);
      console.error('Stop reason:', response.stop_reason);
      console.error('First 500 chars:', jsonText.substring(0, 500));
      console.error('Last 500 chars:', jsonText.substring(jsonText.length - 500));
      return NextResponse.json(
        { error: `Failed to parse AI response. Stop reason: ${response.stop_reason}. Text length: ${textBlock.text.length}` },
        { status: 502 }
      );
    }

    if (!result.categories || !Array.isArray(result.categories)) {
      return NextResponse.json(
        { error: 'AI response missing categories array.' },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to process budget import:', error);
    return NextResponse.json(
      { error: 'Failed to process budget file' },
      { status: 500 }
    );
  }
}

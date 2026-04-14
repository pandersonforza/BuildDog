import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SHEET_URLS: Record<string, string> = {
  F7B: "https://docs.google.com/spreadsheets/d/14ntOeldcbGSU4_vifWsBLH0mFD1PMTqT3S9Fvpg-96c/export?format=csv",
  H7B: "https://docs.google.com/spreadsheets/d/1AawR7WBYURTPIApFzLVicUbH8IM-47vQLUZkKuSOegw/export?format=csv",
  Forza: "https://docs.google.com/spreadsheets/d/1oWagUX8kMYu0fCgzavEW-RRPNKlRZUWsLZeFSTB2KNI/export?format=csv",
  Harman: "https://docs.google.com/spreadsheets/d/1oWagUX8kMYu0fCgzavEW-RRPNKlRZUWsLZeFSTB2KNI/export?format=csv",
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  while (i < text.length) {
    const row: string[] = [];
    while (i < text.length && text[i] !== "\r" && text[i] !== "\n") {
      if (text[i] === '"') {
        i++;
        let field = "";
        while (i < text.length) {
          if (text[i] === '"' && i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else if (text[i] === '"') {
            i++;
            break;
          } else {
            field += text[i++];
          }
        }
        row.push(field);
        if (i < text.length && text[i] === ",") i++;
      } else {
        let field = "";
        while (i < text.length && text[i] !== "," && text[i] !== "\r" && text[i] !== "\n") {
          field += text[i++];
        }
        row.push(field);
        if (i < text.length && text[i] === ",") i++;
      }
    }
    if (i < text.length && text[i] === "\r") i++;
    if (i < text.length && text[i] === "\n") i++;
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

async function fetchFromSheet(group: string): Promise<{ headers: string[]; rows: string[][] }> {
  const url = SHEET_URLS[group];
  if (!url) throw new Error(`Unknown group: ${group}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);

  const text = await res.text();
  const allRows = parseCSV(text);
  if (allRows.length === 0) return { headers: [], rows: [] };

  const headers = allRows[0];
  let rows = allRows.slice(1);

  if (group === "Forza" || group === "Harman") {
    const idCol = headers.findIndex((h) => /project\s*id/i.test(h.trim()));
    rows = rows.filter((row) => {
      const id = (row[idCol] ?? "").trim();
      if (!id || id.startsWith("(")) return false;
      return group === "Forza" ? id.startsWith("FZD") : !id.startsWith("FZD");
    });
  }

  return { headers, rows };
}

// GET — return saved data from DB; if none yet, pull from Sheets and seed
export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "F7B";
  if (!SHEET_URLS[group]) return NextResponse.json({ error: "Unknown group" }, { status: 400 });

  try {
    const existing = await prisma.pipelineSheet.findUnique({ where: { group } });
    if (existing) {
      return NextResponse.json({ headers: existing.headers, rows: existing.rows });
    }

    // First load: seed from Google Sheets
    const { headers, rows } = await fetchFromSheet(group);
    await prisma.pipelineSheet.create({
      data: { group, headers, rows, syncedAt: new Date() },
    });
    return NextResponse.json({ headers, rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — save edited headers + rows from a user
export async function PATCH(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "F7B";
  if (!SHEET_URLS[group]) return NextResponse.json({ error: "Unknown group" }, { status: 400 });

  try {
    const { headers, rows } = await req.json();
    await prisma.pipelineSheet.upsert({
      where: { group },
      update: { headers, rows },
      create: { group, headers, rows },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}


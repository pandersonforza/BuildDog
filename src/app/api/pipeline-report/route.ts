import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "H7B";
  const url = SHEET_URLS[group];
  if (!url) return NextResponse.json({ error: "Unknown group" }, { status: 400 });

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);

    const text = await res.text();
    const allRows = parseCSV(text);
    if (allRows.length === 0) return NextResponse.json({ headers: [], rows: [] });

    const headers = allRows[0];
    let rows = allRows.slice(1);

    // Filter the shared Forza/Harman sheet by project ID prefix
    if (group === "Forza" || group === "Harman") {
      const idCol = headers.findIndex((h) => /project\s*id/i.test(h.trim()));
      rows = rows.filter((row) => {
        const id = (row[idCol] ?? "").trim();
        if (!id || id.startsWith("(")) return false; // skip blank/section headers
        if (group === "Forza") return id.startsWith("FZD");
        return !id.startsWith("FZD"); // Harman = everything else
      });
    }

    return NextResponse.json({ headers, rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

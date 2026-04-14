"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

const GROUPS = ["F7B", "H7B", "Forza", "Harman"] as const;
type Group = (typeof GROUPS)[number];

interface SheetData {
  headers: string[];
  rows: string[][];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 240) + "px";
}

// ── Spreadsheet Table ──────────────────────────────────────────────────────────

function SpreadsheetTable({
  headers,
  rows,
  onRowsChange,
}: {
  headers: string[];
  rows: string[][];
  onRowsChange: (rows: string[][]) => void;
}) {
  const [editing, setEditing] = React.useState<{ row: number; col: number } | null>(null);
  const [draft, setDraft] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Clear editing when rows are replaced (e.g. after sync)
  const rowsRef = React.useRef(rows);
  if (rowsRef.current !== rows) {
    rowsRef.current = rows;
    setEditing(null);
  }

  React.useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      autoResize(textareaRef.current);
    }
  }, [editing]);

  const commitEdit = React.useCallback(
    (ri: number, ci: number, value: string): string[][] => {
      const next = rows.map((r) => [...r]);
      if (next[ri]) next[ri][ci] = value;
      setEditing(null);
      onRowsChange(next);
      return next;
    },
    [rows, onRowsChange]
  );

  const startEdit = (ri: number, ci: number, currentRows: string[][]) => {
    setEditing({ row: ri, col: ci });
    setDraft(currentRows[ri]?.[ci] ?? "");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    ri: number,
    ci: number
  ) => {
    if (e.key === "Escape") { setEditing(null); return; }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const updated = commitEdit(ri, ci, draft);
      if (ri + 1 < updated.length) startEdit(ri + 1, ci, updated);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const updated = commitEdit(ri, ci, draft);
      if (e.shiftKey) {
        const pc = ci - 1;
        const pr = pc < 0 ? ri - 1 : ri;
        const tc = pc < 0 ? headers.length - 1 : pc;
        if (pr >= 0) startEdit(pr, tc, updated);
      } else {
        const nc = ci + 1;
        const nr = nc >= headers.length ? ri + 1 : ri;
        const tc = nc >= headers.length ? 0 : nc;
        if (nr < updated.length) startEdit(nr, tc, updated);
      }
    }
  };

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground italic">
        No rows found.
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="border-collapse text-[11px] min-w-max">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`sticky top-0 border border-border bg-muted px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap select-none ${
                  i === 0 ? "left-0 z-20" : "z-10"
                }`}
              >
                {h.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const baseBg = ri % 2 === 0 ? "bg-background" : "bg-muted/20";
            return (
              <tr key={ri} className={baseBg}>
                {headers.map((_, ci) => {
                  const isActive = editing?.row === ri && editing?.col === ci;
                  return (
                    <td
                      key={ci}
                      className={`border p-0 align-top ${
                        isActive
                          ? "border-blue-400 ring-1 ring-inset ring-blue-400 relative z-10"
                          : "border-border"
                      } ${ci === 0 ? `sticky left-0 font-medium ${baseBg}` : ""}`}
                      onClick={() => { if (!isActive) startEdit(ri, ci, rows); }}
                    >
                      {isActive ? (
                        <textarea
                          ref={textareaRef}
                          value={draft}
                          onChange={(e) => { setDraft(e.target.value); autoResize(e.target); }}
                          onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                          onBlur={() => commitEdit(ri, ci, draft)}
                          className="block w-full min-w-[120px] bg-blue-50 dark:bg-blue-950/30 outline-none text-[11px] px-2 py-0.5 resize-none overflow-hidden leading-relaxed"
                          style={{ minHeight: "22px" }}
                          rows={1}
                        />
                      ) : (
                        <div className="px-2 py-0.5 min-h-[22px] min-w-[60px] max-w-[320px] cursor-default whitespace-pre-wrap break-words leading-relaxed hover:bg-accent/30">
                          {row[ci] ?? ""}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Group Tab ──────────────────────────────────────────────────────────────────

function GroupTab({ group }: { group: Group }) {
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline-report?group=${group}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setHeaders(d.headers);
      setRows(d.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [group]);

  React.useEffect(() => { load(); }, [load]);

  const save = React.useCallback(
    (newRows: string[][]) => {
      setSaveStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/pipeline-report?group=${group}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headers, rows: newRows }),
          });
          if (!res.ok) throw new Error("Save failed");
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
        } catch {
          setSaveStatus("error");
        }
      }, 800);
    },
    [group, headers]
  );

  const handleRowsChange = React.useCallback(
    (newRows: string[][]) => {
      setRows(newRows);
      save(newRows);
    },
    [save]
  );


  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading {group} data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm text-destructive">Error: {error}</p>
        <button onClick={load} className="text-xs text-muted-foreground underline hover:text-foreground">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {rows.length} row{rows.length !== 1 ? "s" : ""}
          </span>
          {saveStatus === "saving" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-emerald-600">Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-destructive">Save failed</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <SpreadsheetTable
          headers={headers}
          rows={rows}
          onRowsChange={handleRowsChange}
        />
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export function PipelineReport() {
  const [activeGroup, setActiveGroup] = React.useState<Group>("F7B");

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border bg-card shrink-0">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeGroup === g
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {GROUPS.map((g) => (
          <div key={g} className={`h-full ${activeGroup === g ? "flex flex-col" : "hidden"}`}>
            <GroupTab group={g} />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

const GROUPS = ["F7B", "H7B", "Forza", "Harman"] as const;
type Group = (typeof GROUPS)[number];

interface SheetData {
  headers: string[];
  rows: string[][];
}

function useSheetData(group: Group) {
  const [data, setData] = React.useState<SheetData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pipeline-report?group=${group}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [group]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

// Auto-resize a textarea to fit its content
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 240) + "px";
}

function SpreadsheetTable({ headers, rows: initialRows }: SheetData) {
  const [rows, setRows] = React.useState<string[][]>(initialRows);
  const [editing, setEditing] = React.useState<{ row: number; col: number } | null>(null);
  const [draft, setDraft] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Reset local rows when initialRows changes (e.g. after a Refresh)
  const prevInitial = React.useRef(initialRows);
  if (prevInitial.current !== initialRows) {
    prevInitial.current = initialRows;
    setRows(initialRows);
    setEditing(null);
  }

  const startEdit = React.useCallback(
    (ri: number, ci: number, rows: string[][]) => {
      setEditing({ row: ri, col: ci });
      setDraft(rows[ri]?.[ci] ?? "");
    },
    []
  );

  // Focus + resize textarea when editing cell changes
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
      setRows(next);
      setEditing(null);
      return next;
    },
    [rows]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, ri: number, ci: number) => {
    if (e.key === "Escape") {
      setEditing(null);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const updated = commitEdit(ri, ci, draft);
      const nextRow = ri + 1;
      if (nextRow < updated.length) startEdit(nextRow, ci, updated);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const updated = commitEdit(ri, ci, draft);
      if (e.shiftKey) {
        const prevCol = ci - 1;
        const prevRow = prevCol < 0 ? ri - 1 : ri;
        const targetCol = prevCol < 0 ? headers.length - 1 : prevCol;
        if (prevRow >= 0) startEdit(prevRow, targetCol, updated);
      } else {
        const nextCol = ci + 1;
        const nextRow = nextCol >= headers.length ? ri + 1 : ri;
        const targetCol = nextCol >= headers.length ? 0 : nextCol;
        if (nextRow < updated.length) startEdit(nextRow, targetCol, updated);
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
    <div
      className="overflow-auto h-full"
      // Click outside table clears editing
      onMouseDown={(e) => {
        if (editing && !(e.target as Element).closest("textarea")) {
          commitEdit(editing.row, editing.col, draft);
        }
      }}
    >
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
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}
            >
              {headers.map((_, ci) => {
                const isActive = editing?.row === ri && editing?.col === ci;
                const cellBg =
                  ci === 0
                    ? ri % 2 === 0
                      ? "bg-background"
                      : "bg-muted/20"
                    : "";

                return (
                  <td
                    key={ci}
                    className={`border p-0 align-top ${
                      isActive
                        ? "border-blue-400 ring-1 ring-blue-400 ring-inset z-10 relative"
                        : "border-border"
                    } ${ci === 0 ? `sticky left-0 font-medium ${cellBg}` : ""}`}
                    onClick={() => {
                      if (!isActive) startEdit(ri, ci, rows);
                    }}
                  >
                    {isActive ? (
                      <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          autoResize(e.target);
                        }}
                        onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                        onBlur={() => commitEdit(ri, ci, draft)}
                        className="block w-full min-w-[120px] bg-blue-50 dark:bg-blue-950/30 outline-none text-[11px] px-2 py-0.5 resize-none overflow-hidden leading-relaxed"
                        style={{ minHeight: "22px" }}
                        rows={1}
                      />
                    ) : (
                      <div className="px-2 py-0.5 min-h-[22px] cursor-default whitespace-pre-wrap break-words min-w-[60px] max-w-[320px] leading-relaxed hover:bg-accent/30">
                        {row[ci] ?? ""}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupTab({ group }: { group: Group }) {
  const { data, loading, error, reload } = useSheetData(group);

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
        <p className="text-sm text-destructive">Failed to load sheet: {error}</p>
        <button
          onClick={reload}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <span className="text-xs text-muted-foreground">
          {data.rows.length} row{data.rows.length !== 1 ? "s" : ""}
          <span className="ml-2 opacity-60">· Edits are local — refresh reloads from Google Sheets</span>
        </span>
        <button
          onClick={reload}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <SpreadsheetTable headers={data.headers} rows={data.rows} />
      </div>
    </div>
  );
}

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

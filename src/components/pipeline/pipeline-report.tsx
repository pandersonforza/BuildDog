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

function SheetTable({ headers, rows }: SheetData) {
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
                className={`sticky top-0 border border-border bg-muted px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap ${
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
              className={`hover:bg-accent/40 transition-colors ${
                ri % 2 === 0 ? "bg-background" : "bg-muted/20"
              }`}
            >
              {headers.map((_, ci) => (
                <td
                  key={ci}
                  className={`border border-border px-2 py-0.5 whitespace-nowrap max-w-[300px] truncate ${
                    ci === 0
                      ? "sticky left-0 font-medium bg-inherit"
                      : ""
                  }`}
                  title={row[ci] ?? ""}
                >
                  {row[ci] ?? ""}
                </td>
              ))}
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
        <SheetTable headers={data.headers} rows={data.rows} />
      </div>
    </div>
  );
}

export function PipelineReport() {
  const [activeGroup, setActiveGroup] = React.useState<Group>("F7B");

  return (
    <div className="flex flex-col h-full">
      {/* Group tabs */}
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

      {/* Active tab content — mount all, hide inactive to avoid refetch on tab switch */}
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

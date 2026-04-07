"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Printer, FileDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Investor {
  id: string;
  name: string;
  contribution: number;
  equityPct: number; // 0 = derive from contribution share
}

type DistributionMethod =
  | "pro-rata-contribution"
  | "pro-rata-equity"
  | "preferred-return";

interface Result {
  investor: Investor;
  effectiveEquityPct: number;
  prefReturnAmount: number;
  proRataAmount: number;
  total: number;
  netReturn: number;
  roi: number;
  multiple: number;
}

interface Project {
  name: string;
  address: string;
  projectGroup: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _counter = 0;
const uid = () => `inv-${++_counter}-${Date.now()}`;

const fmt2 = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// ─── Component ────────────────────────────────────────────────────────────────

export function DistributionSheet({ projectId }: { projectId: string }) {
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([
    { id: uid(), name: "", contribution: 0, equityPct: 0 },
    { id: uid(), name: "", contribution: 0, equityPct: 0 },
  ]);
  const [distributionAmount, setDistributionAmount] = useState(0);
  const [method, setMethod] = useState<DistributionMethod>("pro-rata-contribution");
  const [prefReturnPct, setPrefReturnPct] = useState(8);
  const [holdYears, setHoldYears] = useState(1);
  const [reportTitle, setReportTitle] = useState("Investor Distribution Report");
  const [notes, setNotes] = useState("");

  // Load project info for the report header
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) =>
        setProject({ name: d.name, address: d.address, projectGroup: d.projectGroup })
      )
      .catch(() => {});
  }, [projectId]);

  // ── Investor CRUD ────────────────────────────────────────────────────────

  const addInvestor = () =>
    setInvestors((prev) => [...prev, { id: uid(), name: "", contribution: 0, equityPct: 0 }]);

  const removeInvestor = (id: string) =>
    setInvestors((prev) => prev.filter((i) => i.id !== id));

  const updateInvestor = (id: string, field: keyof Omit<Investor, "id">, raw: string) => {
    const value =
      field === "name" ? raw : parseFloat(raw) || 0;
    setInvestors((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  // ── Calculations ─────────────────────────────────────────────────────────

  const calculate = useCallback((): Result[] => {
    const valid = investors.filter((i) => i.name.trim() && i.contribution > 0);
    if (valid.length === 0 || distributionAmount <= 0) return [];

    const totalContributions = valid.reduce((s, i) => s + i.contribution, 0);
    const totalEquityEntered = valid.reduce((s, i) => s + i.equityPct, 0);

    return valid.map((inv) => {
      let effectiveEquityPct: number;
      let prefReturnAmount = 0;
      let proRataAmount = 0;

      if (method === "pro-rata-contribution") {
        effectiveEquityPct =
          totalContributions > 0 ? (inv.contribution / totalContributions) * 100 : 0;
        proRataAmount = (effectiveEquityPct / 100) * distributionAmount;
      } else if (method === "pro-rata-equity") {
        // Use entered equity %; fall back to contribution share if none entered
        effectiveEquityPct =
          totalEquityEntered > 0
            ? (inv.equityPct / totalEquityEntered) * 100
            : totalContributions > 0
            ? (inv.contribution / totalContributions) * 100
            : 0;
        proRataAmount = (effectiveEquityPct / 100) * distributionAmount;
      } else {
        // Preferred return first, then pro-rata remainder by contribution share
        effectiveEquityPct =
          totalContributions > 0 ? (inv.contribution / totalContributions) * 100 : 0;

        const myPref = inv.contribution * (prefReturnPct / 100) * holdYears;
        const totalPref = valid.reduce(
          (s, i) => s + i.contribution * (prefReturnPct / 100) * holdYears,
          0
        );

        if (distributionAmount <= totalPref) {
          // Not enough to cover full pref — pro-rate pref payment proportionally
          prefReturnAmount = totalPref > 0 ? (myPref / totalPref) * distributionAmount : 0;
          proRataAmount = 0;
        } else {
          // Full pref paid, distribute remainder pro-rata by contribution share
          prefReturnAmount = myPref;
          const remaining = distributionAmount - totalPref;
          proRataAmount = (effectiveEquityPct / 100) * remaining;
        }
      }

      const total = prefReturnAmount + proRataAmount;
      return {
        investor: inv,
        effectiveEquityPct,
        prefReturnAmount,
        proRataAmount,
        total,
        netReturn: total - inv.contribution,
        roi: inv.contribution > 0 ? (total / inv.contribution - 1) * 100 : 0,
        multiple: inv.contribution > 0 ? total / inv.contribution : 0,
      };
    });
  }, [investors, distributionAmount, method, prefReturnPct, holdYears]);

  const results = calculate();
  const validInvestors = investors.filter((i) => i.name.trim() && i.contribution > 0);
  const totalContributions = validInvestors.reduce((s, i) => s + i.contribution, 0);
  const totalDistributed = results.reduce((s, r) => s + r.total, 0);
  const overallMultiple = totalContributions > 0 ? totalDistributed / totalContributions : 0;
  const overallROI = totalContributions > 0 ? (overallMultiple - 1) * 100 : 0;
  const showPrefColumns = method === "preferred-return";

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (results.length === 0) {
      toast({ title: "Nothing to export", description: "Add investors and a distribution amount first.", variant: "destructive" });
      return;
    }
    const header = showPrefColumns
      ? "Investor,Contribution,Equity %,Pref Return,Pro-Rata,Total Distribution,Net Return,ROI %,Equity Multiple"
      : "Investor,Contribution,Equity %,Total Distribution,Net Return,ROI %,Equity Multiple";
    const rows = results.map((r) =>
      showPrefColumns
        ? `"${r.investor.name}",${r.investor.contribution},${r.effectiveEquityPct.toFixed(2)},${r.prefReturnAmount.toFixed(2)},${r.proRataAmount.toFixed(2)},${r.total.toFixed(2)},${r.netReturn.toFixed(2)},${r.roi.toFixed(2)},${r.multiple.toFixed(2)}`
        : `"${r.investor.name}",${r.investor.contribution},${r.effectiveEquityPct.toFixed(2)},${r.total.toFixed(2)},${r.netReturn.toFixed(2)},${r.roi.toFixed(2)},${r.multiple.toFixed(2)}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distribution-${project?.name?.replace(/\s+/g, "-") ?? projectId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const methodLabel: Record<DistributionMethod, string> = {
    "pro-rata-contribution": "Pro-Rata by Contribution",
    "pro-rata-equity": "Pro-Rata by Equity %",
    "preferred-return": `${prefReturnPct}% Preferred Return + Pro-Rata`,
  };

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Setup Section (hidden when printing) ──────────────────────── */}
      <div className="print:hidden space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Distribution Calculator</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Model investor distributions and generate a net-out report.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileDown className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print Report
            </Button>
          </div>
        </div>

        {/* Report title */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Report Title</Label>
            <Input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Investor Distribution Report"
            />
          </div>
        </div>

        {/* Investors table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Investors</span>
            <Button variant="ghost" size="sm" onClick={addInvestor} className="h-7 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Investor
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="py-2 px-4 font-medium">Investor Name</th>
                <th className="py-2 px-4 font-medium w-44">Capital Contributed</th>
                {method === "pro-rata-equity" && (
                  <th className="py-2 px-4 font-medium w-32">Equity %</th>
                )}
                <th className="py-2 px-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {investors.map((inv) => (
                <tr key={inv.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 px-4">
                    <Input
                      value={inv.name}
                      onChange={(e) => updateInvestor(inv.id, "name", e.target.value)}
                      placeholder="Investor name"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="py-1.5 px-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        value={inv.contribution || ""}
                        onChange={(e) => updateInvestor(inv.id, "contribution", e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm pl-6"
                      />
                    </div>
                  </td>
                  {method === "pro-rata-equity" && (
                    <td className="py-1.5 px-4">
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={inv.equityPct || ""}
                          onChange={(e) => updateInvestor(inv.id, "equityPct", e.target.value)}
                          placeholder="0"
                          className="h-8 text-sm pr-6"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </td>
                  )}
                  <td className="py-1.5 px-4">
                    {investors.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeInvestor(inv.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {totalContributions > 0 && (
              <tfoot className="bg-muted/20 border-t border-border">
                <tr>
                  <td className="py-2 px-4 text-sm font-semibold">
                    Total ({validInvestors.length} investors)
                  </td>
                  <td className="py-2 px-4 text-sm font-semibold">
                    {formatCurrency(totalContributions)}
                  </td>
                  {method === "pro-rata-equity" && (
                    <td className="py-2 px-4 text-sm font-semibold">
                      {fmt2(investors.reduce((s, i) => s + i.equityPct, 0))}%
                    </td>
                  )}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Distribution Settings */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border">
            <span className="text-sm font-semibold">Distribution Settings</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Amount to Distribute</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={distributionAmount || ""}
                  onChange={(e) => setDistributionAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Distribution Method</Label>
              <SelectNative
                value={method}
                onChange={(e) => setMethod(e.target.value as DistributionMethod)}
                options={[
                  { value: "pro-rata-contribution", label: "Pro-Rata by Contribution" },
                  { value: "pro-rata-equity", label: "Pro-Rata by Equity %" },
                  { value: "preferred-return", label: "Preferred Return + Pro-Rata" },
                ]}
              />
            </div>
            {method === "preferred-return" && (
              <>
                <div className="space-y-1.5">
                  <Label>Preferred Return Rate</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={prefReturnPct}
                      onChange={(e) => setPrefReturnPct(parseFloat(e.target.value) || 0)}
                      className="pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Hold Period (years)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    value={holdYears}
                    onChange={(e) => setHoldYears(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </>
            )}
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-1.5">
              <Label>Report Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes to appear on the printed report..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Report (always visible, print-optimized) ───────────────────── */}
      {results.length > 0 && distributionAmount > 0 ? (
        <div className="mt-8 print:mt-0 space-y-6">

          {/* Report Header */}
          <div className="print:block">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold print:text-black">{reportTitle}</h1>
                {project && (
                  <p className="text-muted-foreground print:text-gray-600 mt-1">
                    {project.name}
                    {project.address ? ` · ${project.address}` : ""}
                    {project.projectGroup ? ` · ${project.projectGroup}` : ""}
                  </p>
                )}
                <p className="text-sm text-muted-foreground print:text-gray-500 mt-0.5">
                  Generated {today} · {methodLabel[method]}
                </p>
              </div>
              <div className="print:hidden flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <FileDown className="h-4 w-4 mr-1.5" />
                  Export CSV
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1.5" />
                  Print Report
                </Button>
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
            {[
              { label: "Total Capital Raised", value: formatCurrency(totalContributions) },
              { label: "Total Distribution", value: formatCurrency(totalDistributed) },
              {
                label: "Overall Return",
                value: `${overallROI >= 0 ? "+" : ""}${fmt2(overallROI)}%`,
                highlight: overallROI >= 0,
              },
              { label: "Equity Multiple", value: `${fmt2(overallMultiple)}x` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-border bg-muted/20 p-4 print:border-gray-300"
              >
                <p className="text-xs text-muted-foreground print:text-gray-500 mb-1">{stat.label}</p>
                <p
                  className={`text-xl font-bold ${
                    stat.highlight === true
                      ? "text-emerald-500 print:text-emerald-700"
                      : stat.highlight === false
                      ? "text-red-500 print:text-red-700"
                      : ""
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Distribution table */}
          <div className="rounded-lg border border-border overflow-hidden print:border-gray-300">
            <div className="bg-muted/30 px-4 py-2.5 border-b border-border print:bg-gray-100 print:border-gray-300">
              <span className="text-sm font-semibold">Investor Distribution Breakdown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border print:border-gray-300 text-muted-foreground print:text-gray-600 text-left bg-muted/10 print:bg-gray-50">
                    <th className="py-2.5 px-4 font-medium">Investor</th>
                    <th className="py-2.5 px-4 font-medium text-right">Capital Contributed</th>
                    <th className="py-2.5 px-4 font-medium text-right">Equity %</th>
                    {showPrefColumns && (
                      <>
                        <th className="py-2.5 px-4 font-medium text-right">Pref Return</th>
                        <th className="py-2.5 px-4 font-medium text-right">Pro-Rata</th>
                      </>
                    )}
                    <th className="py-2.5 px-4 font-medium text-right">Distribution</th>
                    <th className="py-2.5 px-4 font-medium text-right">Net Return</th>
                    <th className="py-2.5 px-4 font-medium text-right">ROI</th>
                    <th className="py-2.5 px-4 font-medium text-right">Multiple</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.investor.id}
                      className="border-b border-border/50 print:border-gray-200 hover:bg-muted/20 print:hover:bg-transparent"
                    >
                      <td className="py-2.5 px-4 font-medium">{r.investor.name}</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">
                        {formatCurrency(r.investor.contribution)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">
                        {fmt2(r.effectiveEquityPct)}%
                      </td>
                      {showPrefColumns && (
                        <>
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">
                            {formatCurrency(r.prefReturnAmount)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">
                            {formatCurrency(r.proRataAmount)}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 px-4 text-right font-semibold">
                        {formatCurrency(r.total)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-medium ${
                          r.netReturn >= 0
                            ? "text-emerald-500 print:text-emerald-700"
                            : "text-red-500 print:text-red-700"
                        }`}
                      >
                        {r.netReturn >= 0 ? "+" : ""}
                        {formatCurrency(r.netReturn)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-medium ${
                          r.roi >= 0
                            ? "text-emerald-500 print:text-emerald-700"
                            : "text-red-500 print:text-red-700"
                        }`}
                      >
                        {r.roi >= 0 ? "+" : ""}
                        {fmt2(r.roi)}%
                      </td>
                      <td className="py-2.5 px-4 text-right">{fmt2(r.multiple)}x</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/20 print:bg-gray-50 border-t-2 border-border print:border-gray-300">
                  <tr>
                    <td className="py-2.5 px-4 font-bold">
                      Total ({results.length} investors)
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold">
                      {formatCurrency(totalContributions)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold">100.00%</td>
                    {showPrefColumns && (
                      <>
                        <td className="py-2.5 px-4 text-right font-bold">
                          {formatCurrency(results.reduce((s, r) => s + r.prefReturnAmount, 0))}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold">
                          {formatCurrency(results.reduce((s, r) => s + r.proRataAmount, 0))}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-4 text-right font-bold">
                      {formatCurrency(totalDistributed)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold ${
                        totalDistributed - totalContributions >= 0
                          ? "text-emerald-500 print:text-emerald-700"
                          : "text-red-500 print:text-red-700"
                      }`}
                    >
                      {totalDistributed - totalContributions >= 0 ? "+" : ""}
                      {formatCurrency(totalDistributed - totalContributions)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold ${
                        overallROI >= 0
                          ? "text-emerald-500 print:text-emerald-700"
                          : "text-red-500 print:text-red-700"
                      }`}
                    >
                      {overallROI >= 0 ? "+" : ""}
                      {fmt2(overallROI)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold">{fmt2(overallMultiple)}x</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {notes.trim() && (
            <div className="rounded-lg border border-border print:border-gray-300 p-4">
              <p className="text-xs font-semibold text-muted-foreground print:text-gray-500 uppercase tracking-wide mb-2">
                Notes
              </p>
              <p className="text-sm whitespace-pre-wrap print:text-black">{notes}</p>
            </div>
          )}

          {/* Print footer */}
          <div className="hidden print:block text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
            Prepared with PropHound · {today}
          </div>
        </div>
      ) : (
        // Empty state
        <div className="mt-8 print:hidden rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Add investors and enter a distribution amount above to see the breakdown.
          </p>
        </div>
      )}
    </div>
  );
}

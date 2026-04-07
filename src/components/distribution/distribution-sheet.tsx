"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Printer, FileDown, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Investor {
  id: string;
  name: string;
  contribution: number;
  equityPct: number;
}

type DistributionMethod =
  | "pro-rata-contribution"
  | "pro-rata-equity"
  | "preferred-return"
  | "waterfall";

// Results for simple methods
interface SimpleResult {
  investor: Investor;
  effectiveEquityPct: number;
  prefReturnAmount: number;
  proRataAmount: number;
  total: number;
  netReturn: number;
  roi: number;
  multiple: number;
}

// Results for waterfall
interface WaterfallInvestorResult {
  investor: Investor;
  effectiveEquityPct: number;
  tier1_roc: number;
  tier2_pref: number;
  tier4_lp: number;
  total: number;
  netReturn: number;
  roi: number;
  multiple: number;
}

interface WaterfallOutput {
  investorResults: WaterfallInvestorResult[];
  gp: { name: string; tier3_catchup: number; tier4_gp: number; total: number };
  tiers: {
    t1: number; t2: number; t3: number;
    t4_lp: number; t4_gp: number; t4: number;
  };
  realizedLpIrr: number;       // LP's annualized IRR based on total LP distribution
  hurdlesCleared: number;      // how many IRR hurdles were surpassed
}

interface IrrHurdle {
  id: string;
  irr: number;    // IRR threshold % (e.g. 8 = 8%)
  gpPct: number;  // GP's share of residual once LP IRR exceeds this threshold
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
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const pct = (n: number, total: number) =>
  total > 0 ? `(${fmt2((n / total) * 100)}%)` : "";

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
  const [reportTitle, setReportTitle] = useState("Investor Distribution Report");
  const [notes, setNotes] = useState("");

  // Shared pref-return / waterfall settings
  const [prefReturnPct, setPrefReturnPct] = useState(8);
  const [holdYears, setHoldYears] = useState(1);

  // Waterfall-specific settings
  const [wfTier1Enabled, setWfTier1Enabled] = useState(true);
  const [wfCatchupEnabled, setWfCatchupEnabled] = useState(true);
  const [wfCatchupPct, setWfCatchupPct] = useState(20);
  const [wfGpResidualPct, setWfGpResidualPct] = useState(20);
  const [wfGpName, setWfGpName] = useState("GP / Sponsor");

  // IRR hurdle tiers (T4 override)
  const [wfIrrHurdlesEnabled, setWfIrrHurdlesEnabled] = useState(false);
  const [wfIrrHurdles, setWfIrrHurdles] = useState<IrrHurdle[]>([
    { id: uid(), irr: 8, gpPct: 20 },
    { id: uid(), irr: 15, gpPct: 30 },
  ]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => setProject({ name: d.name, address: d.address, projectGroup: d.projectGroup }))
      .catch(() => {});
  }, [projectId]);

  // ── Investor CRUD ────────────────────────────────────────────────────────

  const addInvestor = () =>
    setInvestors((prev) => [...prev, { id: uid(), name: "", contribution: 0, equityPct: 0 }]);

  const removeInvestor = (id: string) =>
    setInvestors((prev) => prev.filter((i) => i.id !== id));

  const updateInvestor = (id: string, field: keyof Omit<Investor, "id">, raw: string) => {
    const value = field === "name" ? raw : parseFloat(raw) || 0;
    setInvestors((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  // ── IRR Hurdle CRUD ──────────────────────────────────────────────────────

  const addIrrHurdle = () =>
    setWfIrrHurdles((prev) => {
      const sorted = [...prev].sort((a, b) => a.irr - b.irr);
      const lastIrr = sorted.length > 0 ? sorted[sorted.length - 1].irr : 8;
      const lastGp = sorted.length > 0 ? sorted[sorted.length - 1].gpPct : 20;
      return [...prev, { id: uid(), irr: lastIrr + 5, gpPct: Math.min(lastGp + 5, 50) }];
    });

  const removeIrrHurdle = (id: string) =>
    setWfIrrHurdles((prev) => prev.filter((h) => h.id !== id));

  const updateIrrHurdle = (id: string, field: "irr" | "gpPct", raw: string) => {
    const value = parseFloat(raw) || 0;
    setWfIrrHurdles((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  // ── Simple calculation (existing 3 methods) ──────────────────────────────

  const calcSimple = useCallback((): SimpleResult[] => {
    const valid = investors.filter((i) => i.name.trim() && i.contribution > 0);
    if (valid.length === 0 || distributionAmount <= 0) return [];
    const totalC = valid.reduce((s, i) => s + i.contribution, 0);
    const totalEq = valid.reduce((s, i) => s + i.equityPct, 0);

    return valid.map((inv) => {
      let effectiveEquityPct: number;
      let prefReturnAmount = 0;
      let proRataAmount = 0;

      if (method === "pro-rata-contribution") {
        effectiveEquityPct = totalC > 0 ? (inv.contribution / totalC) * 100 : 0;
        proRataAmount = (effectiveEquityPct / 100) * distributionAmount;
      } else if (method === "pro-rata-equity") {
        effectiveEquityPct =
          totalEq > 0
            ? (inv.equityPct / totalEq) * 100
            : totalC > 0 ? (inv.contribution / totalC) * 100 : 0;
        proRataAmount = (effectiveEquityPct / 100) * distributionAmount;
      } else {
        // preferred-return
        effectiveEquityPct = totalC > 0 ? (inv.contribution / totalC) * 100 : 0;
        const myPref = inv.contribution * (prefReturnPct / 100) * holdYears;
        const totalPref = valid.reduce((s, i) => s + i.contribution * (prefReturnPct / 100) * holdYears, 0);
        if (distributionAmount <= totalPref) {
          prefReturnAmount = totalPref > 0 ? (myPref / totalPref) * distributionAmount : 0;
        } else {
          prefReturnAmount = myPref;
          proRataAmount = (effectiveEquityPct / 100) * (distributionAmount - totalPref);
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

  // ── Waterfall calculation ────────────────────────────────────────────────

  const calcWaterfall = useCallback((): WaterfallOutput | null => {
    const valid = investors.filter((i) => i.name.trim() && i.contribution > 0);
    if (valid.length === 0 || distributionAmount <= 0) return null;

    const totalC = valid.reduce((s, i) => s + i.contribution, 0);
    let remaining = distributionAmount;

    // Tier 1 — Return of Capital
    const t1Map: Record<string, number> = {};
    let t1_total = 0;
    if (wfTier1Enabled && remaining > 0) {
      const available = Math.min(remaining, totalC);
      valid.forEach((inv) => {
        t1Map[inv.id] = totalC > 0 ? (inv.contribution / totalC) * available : 0;
      });
      t1_total = available;
      remaining -= available;
    }

    // Tier 2 — Preferred Return
    const t2Map: Record<string, number> = {};
    let t2_total = 0;
    if (remaining > 0) {
      const prefMap: Record<string, number> = {};
      valid.forEach((inv) => { prefMap[inv.id] = inv.contribution * (prefReturnPct / 100) * holdYears; });
      const totalPref = Object.values(prefMap).reduce((s, v) => s + v, 0);
      if (remaining >= totalPref) {
        valid.forEach((inv) => { t2Map[inv.id] = prefMap[inv.id]; });
        t2_total = totalPref;
        remaining -= totalPref;
      } else {
        // Pro-rate the pref payment
        valid.forEach((inv) => {
          t2Map[inv.id] = totalPref > 0 ? (prefMap[inv.id] / totalPref) * remaining : 0;
        });
        t2_total = remaining;
        remaining = 0;
      }
    }

    // Tier 3 — GP Catch-up
    // GP receives catch-up so their share of LP profits (from Tier 2) + catch-up = wfCatchupPct%
    // Formula: catchup / (t2_total + catchup) = wfCatchupPct / 100
    //          catchup = t2_total * wfCatchupPct / (100 - wfCatchupPct)
    let t3_total = 0;
    if (wfCatchupEnabled && remaining > 0) {
      const targetCatchup =
        wfCatchupPct < 100 && t2_total > 0
          ? (t2_total * wfCatchupPct) / (100 - wfCatchupPct)
          : 0;
      t3_total = Math.min(remaining, targetCatchup);
      remaining -= t3_total;
    }

    // Tier 4 — Residual LP / GP split (fixed or IRR-hurdle-based)
    const t4LpMap: Record<string, number> = {};
    let t4_lp = 0;
    let t4_gp = 0;

    if (remaining > 0) {
      if (wfIrrHurdlesEnabled && wfIrrHurdles.length > 0) {
        // ── IRR-hurdle residual ──────────────────────────────────────────
        // LP's total received before T4
        let lp_running = t1_total + t2_total;

        // Build tier intervals:
        //   Before hurdle[0]: LP gets 100%, GP gets 0%
        //   Between hurdle[i] and hurdle[i+1]: GP gets hurdle[i].gpPct
        //   Above last hurdle: GP gets last hurdle's gpPct
        const sorted = [...wfIrrHurdles].sort((a, b) => a.irr - b.irr);

        interface TierInterval { toIrr: number; gpPct: number }
        const intervals: TierInterval[] = [
          { toIrr: sorted[0].irr, gpPct: 0 },
          ...sorted.map((h, i) => ({
            toIrr: i < sorted.length - 1 ? sorted[i + 1].irr : Infinity,
            gpPct: h.gpPct,
          })),
        ];

        for (const tier of intervals) {
          if (remaining <= 0.005) break;
          const lpPct = (100 - tier.gpPct) / 100;
          const gpPct = tier.gpPct / 100;

          // LP amount needed to reach end of this tier
          const lp_target = tier.toIrr === Infinity
            ? Infinity
            : totalC * Math.pow(1 + tier.toIrr / 100, holdYears);

          // Skip if LP already cleared this tier
          if (lp_target !== Infinity && lp_running >= lp_target - 0.005) continue;

          const lp_needed =
            lp_target === Infinity
              ? Infinity
              : Math.max(0, lp_target - lp_running);

          // Gross distribution to give LP exactly lp_needed at lpPct
          const gross_needed =
            lp_needed === Infinity
              ? Infinity
              : lpPct > 0 ? lp_needed / lpPct : remaining;

          const gross = Math.min(remaining, gross_needed === Infinity ? remaining : gross_needed);

          const lp_gets = gross * lpPct;
          const gp_gets = gross * gpPct;

          valid.forEach((inv) => {
            t4LpMap[inv.id] = (t4LpMap[inv.id] ?? 0) +
              (totalC > 0 ? (inv.contribution / totalC) * lp_gets : 0);
          });

          t4_lp += lp_gets;
          t4_gp += gp_gets;
          lp_running += lp_gets;
          remaining -= gross;
        }
      } else {
        // ── Fixed split residual ─────────────────────────────────────────
        t4_lp = remaining * ((100 - wfGpResidualPct) / 100);
        t4_gp = remaining * (wfGpResidualPct / 100);
        valid.forEach((inv) => {
          t4LpMap[inv.id] = totalC > 0 ? (inv.contribution / totalC) * t4_lp : 0;
        });
        remaining = 0;
      }
    }

    const investorResults: WaterfallInvestorResult[] = valid.map((inv) => {
      const r1 = t1Map[inv.id] ?? 0;
      const r2 = t2Map[inv.id] ?? 0;
      const r4 = t4LpMap[inv.id] ?? 0;
      const total = r1 + r2 + r4;
      return {
        investor: inv,
        effectiveEquityPct: totalC > 0 ? (inv.contribution / totalC) * 100 : 0,
        tier1_roc: r1,
        tier2_pref: r2,
        tier4_lp: r4,
        total,
        netReturn: total - inv.contribution,
        roi: inv.contribution > 0 ? (total / inv.contribution - 1) * 100 : 0,
        multiple: inv.contribution > 0 ? total / inv.contribution : 0,
      };
    });

    // Compute LP realized IRR: (total_lp_dist / total_capital)^(1/holdYears) - 1
    const totalLpDist = t1_total + t2_total + t4_lp;
    const realizedLpIrr =
      totalC > 0 && holdYears > 0 && totalLpDist > 0
        ? (Math.pow(totalLpDist / totalC, 1 / holdYears) - 1) * 100
        : 0;

    const sortedHurdles = [...wfIrrHurdles].sort((a, b) => a.irr - b.irr);
    const hurdlesCleared = wfIrrHurdlesEnabled
      ? sortedHurdles.filter((h) => realizedLpIrr >= h.irr).length
      : 0;

    return {
      investorResults,
      gp: { name: wfGpName || "GP / Sponsor", tier3_catchup: t3_total, tier4_gp: t4_gp, total: t3_total + t4_gp },
      tiers: { t1: t1_total, t2: t2_total, t3: t3_total, t4_lp, t4_gp, t4: t4_lp + t4_gp },
      realizedLpIrr,
      hurdlesCleared,
    };
  }, [investors, distributionAmount, prefReturnPct, holdYears, wfTier1Enabled, wfCatchupEnabled, wfCatchupPct, wfGpResidualPct, wfGpName, wfIrrHurdlesEnabled, wfIrrHurdles]);

  // ── Derived values ───────────────────────────────────────────────────────

  const isWaterfall = method === "waterfall";
  const simpleResults = isWaterfall ? [] : calcSimple();
  const waterfallOutput = isWaterfall ? calcWaterfall() : null;

  const validInvestors = investors.filter((i) => i.name.trim() && i.contribution > 0);
  const totalContributions = validInvestors.reduce((s, i) => s + i.contribution, 0);

  const totalDistributed = isWaterfall
    ? (waterfallOutput
        ? waterfallOutput.investorResults.reduce((s, r) => s + r.total, 0) + waterfallOutput.gp.total
        : 0)
    : simpleResults.reduce((s, r) => s + r.total, 0);

  const lpDistributed = isWaterfall
    ? (waterfallOutput?.investorResults.reduce((s, r) => s + r.total, 0) ?? 0)
    : totalDistributed;

  const overallMultiple = totalContributions > 0 ? lpDistributed / totalContributions : 0;
  const overallROI = totalContributions > 0 ? (overallMultiple - 1) * 100 : 0;
  const showPrefColumns = method === "preferred-return";
  const hasResults = isWaterfall
    ? (waterfallOutput?.investorResults.length ?? 0) > 0
    : simpleResults.length > 0;

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (!hasResults) {
      toast({ title: "Nothing to export", description: "Add investors and a distribution amount first.", variant: "destructive" });
      return;
    }

    let csv: string;
    if (isWaterfall && waterfallOutput) {
      const irrNote = wfIrrHurdlesEnabled
        ? `\nLP Realized IRR,${fmt2(waterfallOutput.realizedLpIrr)}%\nHurdles Cleared,${waterfallOutput.hurdlesCleared} of ${wfIrrHurdles.length}`
        : "";
      const header = `Investor,Capital Contributed,Equity %,T1 Return of Capital,T2 Preferred Return,T4 LP Residual,Total Distribution,Net Return,ROI %,Equity Multiple`;
      const rows = waterfallOutput.investorResults.map((r) =>
        `"${r.investor.name}",${r.investor.contribution},${r.effectiveEquityPct.toFixed(2)},${r.tier1_roc.toFixed(2)},${r.tier2_pref.toFixed(2)},${r.tier4_lp.toFixed(2)},${r.total.toFixed(2)},${r.netReturn.toFixed(2)},${r.roi.toFixed(2)},${r.multiple.toFixed(2)}`
      );
      const gp = waterfallOutput.gp;
      rows.push(`"${gp.name} (GP)",,,,${gp.tier3_catchup.toFixed(2)},${gp.tier4_gp.toFixed(2)},${gp.total.toFixed(2)},,`);
      csv = [header, ...rows].join("\n") + irrNote;
    } else {
      const header = showPrefColumns
        ? "Investor,Contribution,Equity %,Pref Return,Pro-Rata,Total,Net Return,ROI %,Multiple"
        : "Investor,Contribution,Equity %,Total,Net Return,ROI %,Multiple";
      const rows = simpleResults.map((r) =>
        showPrefColumns
          ? `"${r.investor.name}",${r.investor.contribution},${r.effectiveEquityPct.toFixed(2)},${r.prefReturnAmount.toFixed(2)},${r.proRataAmount.toFixed(2)},${r.total.toFixed(2)},${r.netReturn.toFixed(2)},${r.roi.toFixed(2)},${r.multiple.toFixed(2)}`
          : `"${r.investor.name}",${r.investor.contribution},${r.effectiveEquityPct.toFixed(2)},${r.total.toFixed(2)},${r.netReturn.toFixed(2)},${r.roi.toFixed(2)},${r.multiple.toFixed(2)}`
      );
      csv = [header, ...rows].join("\n");
    }

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
    "waterfall": wfIrrHurdlesEnabled
      ? `Waterfall — ${prefReturnPct}% Pref · ${wfCatchupEnabled ? `${wfCatchupPct}% GP Catch-up · ` : ""}IRR Hurdle Tiers (${[...wfIrrHurdles].sort((a,b)=>a.irr-b.irr).map(h=>`${h.irr}%`).join(", ")})`
      : `Waterfall — ${prefReturnPct}% Pref · ${wfCatchupEnabled ? `${wfCatchupPct}% GP Catch-up · ` : ""}${100 - wfGpResidualPct}/${wfGpResidualPct} Residual`,
  };

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Setup (print:hidden) ──────────────────────────────────────── */}
      <div className="print:hidden space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Distribution Calculator</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Model investor distributions and generate a net-out report.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileDown className="h-4 w-4 mr-1.5" />Export CSV
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" />Print Report
            </Button>
          </div>
        </div>

        {/* Report title */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Report Title</Label>
            <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Investor Distribution Report" />
          </div>
        </div>

        {/* Investors */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Investors</span>
            <Button variant="ghost" size="sm" onClick={addInvestor} className="h-7 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" />Add Investor
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
                    <Input value={inv.name} onChange={(e) => updateInvestor(inv.id, "name", e.target.value)} placeholder="Investor name" className="h-8 text-sm" />
                  </td>
                  <td className="py-1.5 px-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input type="number" min="0" step="1000" value={inv.contribution || ""} onChange={(e) => updateInvestor(inv.id, "contribution", e.target.value)} placeholder="0" className="h-8 text-sm pl-6" />
                    </div>
                  </td>
                  {method === "pro-rata-equity" && (
                    <td className="py-1.5 px-4">
                      <div className="relative">
                        <Input type="number" min="0" max="100" step="0.1" value={inv.equityPct || ""} onChange={(e) => updateInvestor(inv.id, "equityPct", e.target.value)} placeholder="0" className="h-8 text-sm pr-6" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </td>
                  )}
                  <td className="py-1.5 px-4">
                    {investors.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeInvestor(inv.id)}>
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
                  <td className="py-2 px-4 text-sm font-semibold">Total ({validInvestors.length} investors)</td>
                  <td className="py-2 px-4 text-sm font-semibold">{formatCurrency(totalContributions)}</td>
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
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Amount to Distribute</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" min="0" step="1000" value={distributionAmount || ""} onChange={(e) => setDistributionAmount(parseFloat(e.target.value) || 0)} placeholder="0" className="pl-6" />
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
                    { value: "waterfall", label: "Waterfall Structure" },
                  ]}
                />
              </div>
              {(method === "preferred-return" || method === "waterfall") && (
                <>
                  <div className="space-y-1.5">
                    <Label>Preferred Return Rate</Label>
                    <div className="relative">
                      <Input type="number" min="0" max="100" step="0.5" value={prefReturnPct} onChange={(e) => setPrefReturnPct(parseFloat(e.target.value) || 0)} className="pr-6" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hold Period (years)</Label>
                    <Input type="number" min="0" step="0.25" value={holdYears} onChange={(e) => setHoldYears(parseFloat(e.target.value) || 0)} />
                  </div>
                </>
              )}
            </div>

            {/* Waterfall-specific settings */}
            {method === "waterfall" && (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Waterfall Tiers</p>

                {/* Tier 1 */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="wf-t1"
                    checked={wfTier1Enabled}
                    onChange={(e) => setWfTier1Enabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="wf-t1" className="text-sm font-medium">
                    Tier 1 — Return of Capital
                  </label>
                  <span className="text-xs text-muted-foreground">Investors receive their contributed capital back first</span>
                </div>

                {/* Tier 2 — always on (pref return rate/hold set above) */}
                <div className="flex items-start gap-3">
                  <div className="h-4 w-4 mt-0.5 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-sm bg-primary/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Tier 2 — Preferred Return
                      <span className="text-muted-foreground font-normal ml-1.5">
                        ({prefReturnPct}% × {holdYears} yr = {fmt2(prefReturnPct * holdYears)}% of capital)
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Investors receive their preferred return before any profit split</p>
                  </div>
                </div>

                {/* Tier 3 — GP Catch-up */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="wf-t3"
                      checked={wfCatchupEnabled}
                      onChange={(e) => setWfCatchupEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="wf-t3" className="text-sm font-medium">
                      Tier 3 — GP Catch-up
                    </label>
                  </div>
                  {wfCatchupEnabled && (
                    <div className="ml-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">GP Catch-up Target</Label>
                        <div className="relative">
                          <Input type="number" min="0" max="99" step="1" value={wfCatchupPct} onChange={(e) => setWfCatchupPct(parseFloat(e.target.value) || 0)} className="h-8 text-sm pr-6" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">GP&apos;s target % of profits</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tier 4 — Residual */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Tier 4 — Residual Split</p>

                  {/* GP Name (always shown) */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">GP / Sponsor Name</Label>
                      <Input value={wfGpName} onChange={(e) => setWfGpName(e.target.value)} placeholder="GP / Sponsor" className="h-8 text-sm" />
                    </div>
                  </div>

                  {/* Fixed split — only shown when IRR hurdles are off */}
                  {!wfIrrHurdlesEnabled && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">GP Residual Share</Label>
                        <div className="relative">
                          <Input type="number" min="0" max="100" step="1" value={wfGpResidualPct} onChange={(e) => setWfGpResidualPct(parseFloat(e.target.value) || 0)} className="h-8 text-sm pr-6" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">LP gets {100 - wfGpResidualPct}%</p>
                      </div>
                    </div>
                  )}

                  {/* IRR Hurdle Tiers toggle */}
                  <div className="space-y-3 border-t border-border/40 pt-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="wf-irr"
                        checked={wfIrrHurdlesEnabled}
                        onChange={(e) => setWfIrrHurdlesEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <label htmlFor="wf-irr" className="text-sm font-medium cursor-pointer">
                        IRR-Based Hurdle Tiers
                      </label>
                      <span className="text-xs text-muted-foreground">Override fixed split with IRR hurdles</span>
                    </div>

                    {wfIrrHurdlesEnabled && (
                      <div className="ml-7 space-y-3">
                        <p className="text-xs text-muted-foreground">
                          T4 residual is distributed based on LP&apos;s realized annualized IRR.
                          Below the first hurdle LP gets 100%. Each hurdle defines the GP&apos;s share once that IRR is cleared.
                        </p>

                        {/* Tier summary row */}
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            &lt; {[...wfIrrHurdles].sort((a,b)=>a.irr-b.irr)[0]?.irr ?? 0}% IRR → 100% LP / 0% GP
                          </span>
                          {[...wfIrrHurdles].sort((a,b)=>a.irr-b.irr).map((h, i, arr) => (
                            <span key={h.id} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                              {h.irr}%{i < arr.length - 1 ? `–${arr[i+1].irr}%` : "+"} IRR → {100 - h.gpPct}% LP / {h.gpPct}% GP
                            </span>
                          ))}
                        </div>

                        {/* Hurdle rows */}
                        <div className="space-y-2">
                          {[...wfIrrHurdles]
                            .sort((a, b) => a.irr - b.irr)
                            .map((h, i) => (
                              <div key={h.id} className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground w-[4.5rem] shrink-0">Hurdle {i + 1}</span>
                                <span className="text-xs text-muted-foreground shrink-0">LP IRR ≥</span>
                                <div className="relative w-20">
                                  <Input
                                    type="number" min="0" max="100" step="0.5"
                                    value={h.irr}
                                    onChange={(e) => updateIrrHurdle(h.id, "irr", e.target.value)}
                                    className="h-7 text-xs pr-5"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">→ GP gets</span>
                                <div className="relative w-20">
                                  <Input
                                    type="number" min="0" max="99" step="1"
                                    value={h.gpPct}
                                    onChange={(e) => updateIrrHurdle(h.id, "gpPct", e.target.value)}
                                    className="h-7 text-xs pr-5"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">LP gets {100 - h.gpPct}%</span>
                                {wfIrrHurdles.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeIrrHurdle(h.id)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addIrrHurdle}>
                          <Plus className="h-3 w-3" />Add Hurdle
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

      {/* ── Report ────────────────────────────────────────────────────────── */}
      {hasResults && distributionAmount > 0 ? (
        <div className="mt-8 print:mt-0 space-y-6">

          {/* Report header */}
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold print:text-black">{reportTitle}</h1>
                {project && (
                  <p className="text-muted-foreground print:text-gray-600 mt-1">
                    {project.name}{project.address ? ` · ${project.address}` : ""}{project.projectGroup ? ` · ${project.projectGroup}` : ""}
                  </p>
                )}
                <p className="text-sm text-muted-foreground print:text-gray-500 mt-0.5">
                  Generated {today} · {methodLabel[method]}
                </p>
              </div>
              <div className="print:hidden flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <FileDown className="h-4 w-4 mr-1.5" />Export CSV
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1.5" />Print Report
                </Button>
              </div>
            </div>
          </div>

          {/* Summary stats */}
          {(() => {
            const stats = [
              { label: "Total Capital Raised", value: formatCurrency(totalContributions) },
              { label: isWaterfall ? "LP Distribution" : "Total Distribution", value: formatCurrency(lpDistributed) },
              { label: "LP Return", value: `${overallROI >= 0 ? "+" : ""}${fmt2(overallROI)}%`, color: overallROI >= 0 ? "emerald" : "red" },
              { label: "LP Equity Multiple", value: `${fmt2(overallMultiple)}x` },
            ];
            // Add realized IRR stat for waterfall
            if (isWaterfall && waterfallOutput && holdYears > 0) {
              const irr = waterfallOutput.realizedLpIrr;
              stats.push({
                label: `LP Realized IRR (${holdYears}yr)`,
                value: `${irr >= 0 ? "+" : ""}${fmt2(irr)}%`,
                color: irr >= (prefReturnPct) ? "emerald" : "red",
              });
            }
            return (
              <div className={`grid grid-cols-2 gap-4 print:grid-cols-${stats.length} sm:grid-cols-${stats.length}`}>
                {stats.map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-muted/20 p-4 print:border-gray-300">
                    <p className="text-xs text-muted-foreground print:text-gray-500 mb-1">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color === "emerald" ? "text-emerald-500 print:text-emerald-700" : s.color === "red" ? "text-red-500 print:text-red-700" : ""}`}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Waterfall tier flow ──────────────────────────────────────── */}
          {isWaterfall && waterfallOutput && (
            <div className="rounded-lg border border-border overflow-hidden print:border-gray-300">
              <div className="bg-muted/30 px-4 py-2.5 border-b border-border print:bg-gray-100 print:border-gray-300">
                <span className="text-sm font-semibold">Waterfall Distribution Flow</span>
              </div>
              <div className="p-4">
                <div className="flex flex-col sm:flex-row items-stretch gap-2 print:flex-row">

                  {/* Amount block */}
                  <div className="flex-none rounded-lg border border-border bg-muted/20 p-3 text-center min-w-[120px] print:border-gray-300">
                    <p className="text-xs text-muted-foreground print:text-gray-500">Total Available</p>
                    <p className="text-base font-bold mt-1">{formatCurrency(distributionAmount)}</p>
                  </div>

                  <div className="flex items-center justify-center text-muted-foreground px-1">
                    <ChevronRight className="h-4 w-4" />
                  </div>

                  {/* Tier blocks */}
                  <div className="flex flex-col sm:flex-row gap-2 flex-1 print:flex-row">
                    {wfTier1Enabled && (
                      <TierBlock
                        label="Tier 1"
                        sublabel="Return of Capital"
                        amount={waterfallOutput.tiers.t1}
                        total={distributionAmount}
                        color="blue"
                      />
                    )}
                    <TierBlock
                      label="Tier 2"
                      sublabel={`${prefReturnPct}% Pref Return`}
                      amount={waterfallOutput.tiers.t2}
                      total={distributionAmount}
                      color="violet"
                    />
                    {wfCatchupEnabled && waterfallOutput.tiers.t3 > 0 && (
                      <TierBlock
                        label="Tier 3"
                        sublabel={`GP Catch-up (${wfCatchupPct}%)`}
                        amount={waterfallOutput.tiers.t3}
                        total={distributionAmount}
                        color="amber"
                        gp
                      />
                    )}
                    {waterfallOutput.tiers.t4 > 0 && (
                      <div className="flex-1 rounded-lg border border-border bg-muted/10 p-3 print:border-gray-300">
                        <p className="text-xs font-semibold text-muted-foreground print:text-gray-500">Tier 4 · Residual</p>
                        <p className="text-base font-bold mt-1">{formatCurrency(waterfallOutput.tiers.t4)}</p>
                        <p className="text-xs text-muted-foreground print:text-gray-400">{pct(waterfallOutput.tiers.t4, distributionAmount)} of total</p>
                        {wfIrrHurdlesEnabled ? (
                          <div className="mt-2 space-y-0.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">LP (IRR hurdles)</span>
                              <span className="font-medium">{formatCurrency(waterfallOutput.tiers.t4_lp)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">GP (carried interest)</span>
                              <span className="font-medium">{formatCurrency(waterfallOutput.tiers.t4_gp)}</span>
                            </div>
                            <div className="mt-1.5 pt-1.5 border-t border-border/40 flex justify-between text-muted-foreground">
                              <span>LP Realized IRR</span>
                              <span className={`font-semibold ${waterfallOutput.realizedLpIrr >= prefReturnPct ? "text-emerald-600 print:text-emerald-800" : "text-amber-600 print:text-amber-800"}`}>
                                {fmt2(waterfallOutput.realizedLpIrr)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Hurdles cleared</span>
                              <span>{waterfallOutput.hurdlesCleared} / {wfIrrHurdles.length}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-0.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">LP ({100 - wfGpResidualPct}%)</span>
                              <span className="font-medium">{formatCurrency(waterfallOutput.tiers.t4_lp)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">GP ({wfGpResidualPct}%)</span>
                              <span className="font-medium">{formatCurrency(waterfallOutput.tiers.t4_gp)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Investor distribution table ──────────────────────────────── */}
          <div className="rounded-lg border border-border overflow-hidden print:border-gray-300">
            <div className="bg-muted/30 px-4 py-2.5 border-b border-border print:bg-gray-100 print:border-gray-300">
              <span className="text-sm font-semibold">
                {isWaterfall ? "LP Investor Breakdown" : "Investor Distribution Breakdown"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border print:border-gray-300 text-muted-foreground print:text-gray-600 text-left bg-muted/10 print:bg-gray-50">
                    <th className="py-2.5 px-4 font-medium">Investor</th>
                    <th className="py-2.5 px-4 font-medium text-right">Capital</th>
                    <th className="py-2.5 px-4 font-medium text-right">Equity %</th>
                    {isWaterfall ? (
                      <>
                        {wfTier1Enabled && <th className="py-2.5 px-4 font-medium text-right">T1 ROC</th>}
                        <th className="py-2.5 px-4 font-medium text-right">T2 Pref</th>
                        <th className="py-2.5 px-4 font-medium text-right">T4 LP Share</th>
                      </>
                    ) : showPrefColumns ? (
                      <>
                        <th className="py-2.5 px-4 font-medium text-right">Pref Return</th>
                        <th className="py-2.5 px-4 font-medium text-right">Pro-Rata</th>
                      </>
                    ) : null}
                    <th className="py-2.5 px-4 font-medium text-right">Total</th>
                    <th className="py-2.5 px-4 font-medium text-right">Net Return</th>
                    <th className="py-2.5 px-4 font-medium text-right">ROI</th>
                    <th className="py-2.5 px-4 font-medium text-right">Multiple</th>
                  </tr>
                </thead>
                <tbody>
                  {isWaterfall
                    ? waterfallOutput?.investorResults.map((r) => (
                        <tr key={r.investor.id} className="border-b border-border/50 print:border-gray-200 hover:bg-muted/20 print:hover:bg-transparent">
                          <td className="py-2.5 px-4 font-medium">{r.investor.name}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(r.investor.contribution)}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{fmt2(r.effectiveEquityPct)}%</td>
                          {wfTier1Enabled && <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(r.tier1_roc)}</td>}
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(r.tier2_pref)}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(r.tier4_lp)}</td>
                          <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(r.total)}</td>
                          <ReturnCells netReturn={r.netReturn} roi={r.roi} multiple={r.multiple} />
                        </tr>
                      ))
                    : simpleResults.map((r) => (
                        <tr key={r.investor.id} className="border-b border-border/50 print:border-gray-200 hover:bg-muted/20 print:hover:bg-transparent">
                          <td className="py-2.5 px-4 font-medium">{r.investor.name}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(r.investor.contribution)}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{fmt2(r.effectiveEquityPct)}%</td>
                          {showPrefColumns && (
                            <>
                              <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(r.prefReturnAmount)}</td>
                              <td className="py-2.5 px-4 text-right text-muted-foreground print:text-gray-600">{formatCurrency(r.proRataAmount)}</td>
                            </>
                          )}
                          <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(r.total)}</td>
                          <ReturnCells netReturn={r.netReturn} roi={r.roi} multiple={r.multiple} />
                        </tr>
                      ))
                  }
                </tbody>

                {/* GP row for waterfall */}
                {isWaterfall && waterfallOutput && waterfallOutput.gp.total > 0 && (
                  <tbody>
                    <tr className="border-t-2 border-dashed border-border/60 print:border-gray-300 bg-amber-500/5 print:bg-amber-50">
                      <td className="py-2.5 px-4 font-medium text-amber-600 print:text-amber-800">
                        {waterfallOutput.gp.name}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">(GP)</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">—</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">—</td>
                      {wfTier1Enabled && <td className="py-2.5 px-4 text-right text-muted-foreground">—</td>}
                      <td className="py-2.5 px-4 text-right text-muted-foreground">
                        {wfCatchupEnabled ? formatCurrency(waterfallOutput.gp.tier3_catchup) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">{formatCurrency(waterfallOutput.gp.tier4_gp)}</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(waterfallOutput.gp.total)}</td>
                      <td colSpan={3} className="py-2.5 px-4 text-right text-xs text-muted-foreground">Carried Interest</td>
                    </tr>
                  </tbody>
                )}

                {/* Totals footer */}
                <tfoot className="bg-muted/20 print:bg-gray-50 border-t-2 border-border print:border-gray-300">
                  <tr>
                    <td className="py-2.5 px-4 font-bold">
                      Total ({isWaterfall ? (waterfallOutput?.investorResults.length ?? 0) : simpleResults.length} investors)
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold">{formatCurrency(totalContributions)}</td>
                    <td className="py-2.5 px-4 text-right font-bold">100.00%</td>
                    {isWaterfall ? (
                      <>
                        {wfTier1Enabled && (
                          <td className="py-2.5 px-4 text-right font-bold">
                            {formatCurrency(waterfallOutput?.tiers.t1 ?? 0)}
                          </td>
                        )}
                        <td className="py-2.5 px-4 text-right font-bold">
                          {formatCurrency(waterfallOutput?.tiers.t2 ?? 0)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold">
                          {formatCurrency(waterfallOutput?.tiers.t4_lp ?? 0)}
                        </td>
                      </>
                    ) : showPrefColumns ? (
                      <>
                        <td className="py-2.5 px-4 text-right font-bold">
                          {formatCurrency(simpleResults.reduce((s, r) => s + r.prefReturnAmount, 0))}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold">
                          {formatCurrency(simpleResults.reduce((s, r) => s + r.proRataAmount, 0))}
                        </td>
                      </>
                    ) : null}
                    <td className="py-2.5 px-4 text-right font-bold">{formatCurrency(lpDistributed)}</td>
                    <td className={`py-2.5 px-4 text-right font-bold ${lpDistributed - totalContributions >= 0 ? "text-emerald-500 print:text-emerald-700" : "text-red-500 print:text-red-700"}`}>
                      {lpDistributed - totalContributions >= 0 ? "+" : ""}{formatCurrency(lpDistributed - totalContributions)}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-bold ${overallROI >= 0 ? "text-emerald-500 print:text-emerald-700" : "text-red-500 print:text-red-700"}`}>
                      {overallROI >= 0 ? "+" : ""}{fmt2(overallROI)}%
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
              <p className="text-xs font-semibold text-muted-foreground print:text-gray-500 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm whitespace-pre-wrap print:text-black">{notes}</p>
            </div>
          )}

          <div className="hidden print:block text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
            Prepared with PropHound · {today}
          </div>
        </div>
      ) : (
        <div className="mt-8 print:hidden rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Add investors and enter a distribution amount above to see the breakdown.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function ReturnCells({ netReturn, roi, multiple }: { netReturn: number; roi: number; multiple: number }) {
  const color = (pos: boolean) =>
    pos ? "text-emerald-500 print:text-emerald-700" : "text-red-500 print:text-red-700";
  return (
    <>
      <td className={`py-2.5 px-4 text-right font-medium ${color(netReturn >= 0)}`}>
        {netReturn >= 0 ? "+" : ""}{formatCurrency(netReturn)}
      </td>
      <td className={`py-2.5 px-4 text-right font-medium ${color(roi >= 0)}`}>
        {roi >= 0 ? "+" : ""}{fmt2(roi)}%
      </td>
      <td className="py-2.5 px-4 text-right">{fmt2(multiple)}x</td>
    </>
  );
}

function TierBlock({
  label, sublabel, amount, total, color, gp,
}: {
  label: string; sublabel: string; amount: number; total: number;
  color: "blue" | "violet" | "amber"; gp?: boolean;
}) {
  const border = { blue: "border-blue-500/30", violet: "border-violet-500/30", amber: "border-amber-500/30" }[color];
  const bg = { blue: "bg-blue-500/5", violet: "bg-violet-500/5", amber: "bg-amber-500/5 print:bg-amber-50" }[color];
  const text = { blue: "text-blue-600 print:text-blue-800", violet: "text-violet-600 print:text-violet-800", amber: "text-amber-600 print:text-amber-800" }[color];
  return (
    <div className={`flex-1 rounded-lg border ${border} ${bg} p-3`}>
      <p className={`text-xs font-semibold ${text}`}>{label}{gp ? " · GP" : ""}</p>
      <p className="text-xs text-muted-foreground print:text-gray-500 mt-0.5">{sublabel}</p>
      <p className="text-base font-bold mt-1">{formatCurrency(amount)}</p>
      <p className="text-xs text-muted-foreground print:text-gray-400">{pct(amount, total)} of total</p>
    </div>
  );
}

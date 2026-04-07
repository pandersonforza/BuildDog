"use client";

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

// ─── Types (mirrors distribution-sheet) ──────────────────────────────────────

export interface PDFInvestor {
  id: string;
  name: string;
  contribution: number;
  equityPct: number;
}

export interface PDFSimpleResult {
  investor: PDFInvestor;
  effectiveEquityPct: number;
  prefReturnAmount: number;
  proRataAmount: number;
  total: number;
  netReturn: number;
  roi: number;
  multiple: number;
}

export interface PDFWaterfallInvestorResult {
  investor: PDFInvestor;
  effectiveEquityPct: number;
  tier1_roc: number;
  tier2_pref: number;
  tier4_lp: number;
  total: number;
  netReturn: number;
  roi: number;
  multiple: number;
}

export interface PDFWaterfallOutput {
  investorResults: PDFWaterfallInvestorResult[];
  gp: { name: string; tier3_catchup: number; tier4_gp: number; total: number };
  tiers: { t1: number; t2: number; t3: number; t4_lp: number; t4_gp: number; t4: number };
  realizedLpIrr: number;
  hurdlesCleared: number;
}

export interface DistributionPDFProps {
  reportTitle: string;
  projectName?: string;
  projectAddress?: string;
  projectGroup?: string;
  generatedDate: string;
  methodLabel: string;
  holdStartDate?: string;
  holdEndDate?: string;
  holdYears: number;
  distributionAmount: number;
  totalContributions: number;
  lpDistributed: number;
  overallROI: number;
  overallMultiple: number;
  isWaterfall: boolean;
  waterfallOutput: PDFWaterfallOutput | null;
  simpleResults: PDFSimpleResult[];
  showPrefColumns: boolean;
  wfTier1Enabled: boolean;
  wfCatchupEnabled: boolean;
  wfGpResidualPct: number;
  wfIrrHurdlesEnabled: boolean;
  prefReturnPct: number;
  notes: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const pct2 = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const fmt2 = (n: number) => n.toFixed(2);

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  navy:    "#0f172a",
  navyMid: "#1e293b",
  blue:    "#3b82f6",
  blueLight: "#dbeafe",
  slate:   "#64748b",
  border:  "#e2e8f0",
  bg:      "#f8fafc",
  white:   "#ffffff",
  emerald: "#059669",
  red:     "#dc2626",
  amber:   "#d97706",
  amberBg: "#fffbeb",
  mutedBg: "#f1f5f9",
  text:    "#0f172a",
  muted:   "#64748b",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: "Helvetica", fontSize: 9, color: C.text, paddingBottom: 40 },

  // Header
  header: { backgroundColor: C.navy, paddingHorizontal: 36, paddingTop: 28, paddingBottom: 24 },
  headerTop: { flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-start" },
  headerLogo: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.white, letterSpacing: 1 },
  headerTagline: { fontSize: 7, color: "#94a3b8", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  reportTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.white, textAlign: "right" },
  headerMeta: { fontSize: 8, color: "#94a3b8", marginTop: 3, textAlign: "right" },

  // Body
  body: { paddingHorizontal: 36, paddingTop: 24 },

  // Section
  sectionLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.slate, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },

  // Summary cards
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: C.bg, borderRadius: 6, padding: 10, borderWidth: 1, borderColor: C.border },
  summaryCardLabel: { fontSize: 7, color: C.muted, marginBottom: 4 },
  summaryCardValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.text },
  summaryCardValueGreen: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.emerald },
  summaryCardValueRed: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.red },

  // Table
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 6, overflow: "hidden", marginBottom: 24 },
  tableHeader: { flexDirection: "row", backgroundColor: C.navy, paddingHorizontal: 10, paddingVertical: 7 },
  tableHeaderCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#cbd5e1" },
  tableRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border },
  tableRowAlt: { backgroundColor: C.bg },
  tableRowGP: { backgroundColor: C.amberBg },
  tableRowTotal: { backgroundColor: C.mutedBg, borderTopWidth: 2, borderTopColor: C.border },
  tableCell: { fontSize: 8, color: C.text },
  tableCellMuted: { fontSize: 8, color: C.muted },
  tableCellBold: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.text },
  tableCellGreen: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.emerald },
  tableCellRed: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.red },
  tableCellAmber: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.amber },

  // Waterfall tiers
  tierRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  tierCard: { flex: 1, borderRadius: 6, padding: 10, borderWidth: 1 },
  tierLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tierSublabel: { fontSize: 7, color: C.muted, marginBottom: 6 },
  tierAmount: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tierPct: { fontSize: 7, color: C.muted },
  tierDetailRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  tierDetailLabel: { fontSize: 7, color: C.muted },
  tierDetailValue: { fontSize: 7, fontFamily: "Helvetica-Bold" },

  // Notes
  notesBox: { backgroundColor: C.bg, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 24 },
  notesText: { fontSize: 8, color: C.text, lineHeight: 1.6 },

  // Footer
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 36, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 7, color: C.muted },

  // Divider
  divider: { height: 1, backgroundColor: C.border, marginBottom: 20 },
});

// ─── Column helpers ───────────────────────────────────────────────────────────

const COL = {
  name:   { width: "20%" },
  capital:{ width: "13%" },
  equity: { width: "9%" },
  tier:   { width: "11%" },
  total:  { width: "12%" },
  net:    { width: "12%" },
  roi:    { width: "9%" },
  mult:   { width: "7%" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color?: "green" | "red" }) {
  const valueStyle =
    color === "green" ? s.summaryCardValueGreen :
    color === "red"   ? s.summaryCardValueRed   :
    s.summaryCardValue;
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryCardLabel}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

function TableHeaderCell({ label, style }: { label: string; style?: Style }) {
  return <Text style={[s.tableHeaderCell, style ?? {}]}>{label}</Text>;
}

// ─── Main PDF Document ────────────────────────────────────────────────────────

function DistributionDocument(p: DistributionPDFProps) {
  const {
    reportTitle, projectName, projectAddress, projectGroup,
    generatedDate, methodLabel, holdStartDate, holdEndDate, holdYears,
    distributionAmount, totalContributions, lpDistributed, overallROI, overallMultiple,
    isWaterfall, waterfallOutput, simpleResults, showPrefColumns,
    wfTier1Enabled, wfCatchupEnabled, wfGpResidualPct, wfIrrHurdlesEnabled,
    prefReturnPct, notes,
  } = p;

  const holdLabel = holdYears > 0 ? `${fmt2(holdYears)} yr` : null;
  const dateRange = holdStartDate && holdEndDate
    ? `${new Date(holdStartDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${new Date(holdEndDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : null;

  const summaryCards = [
    { label: "Total Capital Raised", value: usd(totalContributions) },
    { label: isWaterfall ? "LP Distribution" : "Total Distribution", value: usd(lpDistributed) },
    { label: "LP Return", value: pct2(overallROI), color: overallROI >= 0 ? "green" : "red" },
    { label: "Equity Multiple", value: `${fmt2(overallMultiple)}x` },
    ...(isWaterfall && waterfallOutput && holdYears > 0
      ? [{ label: `LP Realized IRR (${holdLabel})`, value: pct2(waterfallOutput.realizedLpIrr), color: waterfallOutput.realizedLpIrr >= prefReturnPct ? "green" : "red" }]
      : []),
  ] as { label: string; value: string; color?: "green" | "red" }[];

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View style={s.headerRight}>
              <Text style={s.reportTitle}>{reportTitle}</Text>
              {projectName && (
                <Text style={s.headerMeta}>
                  {projectName}{projectAddress ? `  ·  ${projectAddress}` : ""}{projectGroup ? `  ·  ${projectGroup}` : ""}
                </Text>
              )}
              <Text style={s.headerMeta}>
                {methodLabel}
                {holdLabel ? `  ·  ${holdLabel} hold` : ""}
                {dateRange ? `  (${dateRange})` : ""}
              </Text>
              <Text style={s.headerMeta}>Generated {generatedDate}</Text>
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>

          {/* Summary Stats */}
          <Text style={s.sectionLabel}>Summary</Text>
          <View style={s.summaryRow}>
            {summaryCards.map((c) => (
              <SummaryCard key={c.label} label={c.label} value={c.value} color={c.color} />
            ))}
          </View>

          {/* ── Waterfall Tier Flow ── */}
          {isWaterfall && waterfallOutput && (
            <>
              <Text style={s.sectionLabel}>Waterfall Distribution Flow</Text>
              <View style={s.tierRow}>
                {wfTier1Enabled && waterfallOutput.tiers.t1 > 0 && (
                  <View style={[s.tierCard, { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }]}>
                    <Text style={[s.tierLabel, { color: "#1d4ed8" }]}>TIER 1  ·  Return of Capital</Text>
                    <Text style={[s.tierAmount, { color: "#1d4ed8" }]}>{usd(waterfallOutput.tiers.t1)}</Text>
                    <Text style={s.tierPct}>{distributionAmount > 0 ? ((waterfallOutput.tiers.t1 / distributionAmount) * 100).toFixed(1) : 0}% of total</Text>
                  </View>
                )}
                <View style={[s.tierCard, { borderColor: "#ddd6fe", backgroundColor: "#f5f3ff" }]}>
                  <Text style={[s.tierLabel, { color: "#6d28d9" }]}>TIER 2  ·  {prefReturnPct}% Preferred Return</Text>
                  <Text style={[s.tierAmount, { color: "#6d28d9" }]}>{usd(waterfallOutput.tiers.t2)}</Text>
                  <Text style={s.tierPct}>{distributionAmount > 0 ? ((waterfallOutput.tiers.t2 / distributionAmount) * 100).toFixed(1) : 0}% of total</Text>
                </View>
                {wfCatchupEnabled && waterfallOutput.tiers.t3 > 0 && (
                  <View style={[s.tierCard, { borderColor: "#fde68a", backgroundColor: C.amberBg }]}>
                    <Text style={[s.tierLabel, { color: C.amber }]}>TIER 3  ·  GP Catch-up</Text>
                    <Text style={[s.tierAmount, { color: C.amber }]}>{usd(waterfallOutput.tiers.t3)}</Text>
                    <Text style={s.tierPct}>{distributionAmount > 0 ? ((waterfallOutput.tiers.t3 / distributionAmount) * 100).toFixed(1) : 0}% of total</Text>
                  </View>
                )}
                {waterfallOutput.tiers.t4 > 0 && (
                  <View style={[s.tierCard, { borderColor: C.border, backgroundColor: C.bg }]}>
                    <Text style={[s.tierLabel, { color: C.slate }]}>TIER 4  ·  Residual Split</Text>
                    <Text style={[s.tierAmount, { color: C.text }]}>{usd(waterfallOutput.tiers.t4)}</Text>
                    <Text style={s.tierPct}>{distributionAmount > 0 ? ((waterfallOutput.tiers.t4 / distributionAmount) * 100).toFixed(1) : 0}% of total</Text>
                    <View style={[s.tierDetailRow, { marginTop: 6 }]}>
                      <Text style={s.tierDetailLabel}>LP ({wfIrrHurdlesEnabled ? "IRR hurdles" : `${100 - wfGpResidualPct}%`})</Text>
                      <Text style={s.tierDetailValue}>{usd(waterfallOutput.tiers.t4_lp)}</Text>
                    </View>
                    <View style={s.tierDetailRow}>
                      <Text style={s.tierDetailLabel}>GP ({wfIrrHurdlesEnabled ? "carried" : `${wfGpResidualPct}%`})</Text>
                      <Text style={[s.tierDetailValue, { color: C.amber }]}>{usd(waterfallOutput.tiers.t4_gp)}</Text>
                    </View>
                    {wfIrrHurdlesEnabled && (
                      <View style={s.tierDetailRow}>
                        <Text style={s.tierDetailLabel}>LP Realized IRR</Text>
                        <Text style={[s.tierDetailValue, { color: waterfallOutput.realizedLpIrr >= prefReturnPct ? C.emerald : C.red }]}>
                          {fmt2(waterfallOutput.realizedLpIrr)}%
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── Investor Table ── */}
          <Text style={s.sectionLabel}>{isWaterfall ? "LP Investor Breakdown" : "Investor Distribution Breakdown"}</Text>
          <View style={s.table}>
            {/* Table header */}
            <View style={s.tableHeader}>
              <TableHeaderCell label="Investor" style={COL.name} />
              <TableHeaderCell label="Capital" style={{ ...COL.capital, textAlign: "right" as const }} />
              <TableHeaderCell label="Equity %" style={{ ...COL.equity, textAlign: "right" as const }} />
              {isWaterfall ? (
                <>
                  {wfTier1Enabled && <TableHeaderCell label="T1 ROC" style={{ ...COL.tier, textAlign: "right" as const }} />}
                  <TableHeaderCell label="T2 Pref" style={{ ...COL.tier, textAlign: "right" as const }} />
                  <TableHeaderCell label="T4 LP" style={{ ...COL.tier, textAlign: "right" as const }} />
                </>
              ) : showPrefColumns ? (
                <>
                  <TableHeaderCell label="Pref Return" style={{ ...COL.tier, textAlign: "right" as const }} />
                  <TableHeaderCell label="Pro-Rata" style={{ ...COL.tier, textAlign: "right" as const }} />
                </>
              ) : null}
              <TableHeaderCell label="Total" style={{ ...COL.total, textAlign: "right" as const }} />
              <TableHeaderCell label="Net Return" style={{ ...COL.net, textAlign: "right" as const }} />
              <TableHeaderCell label="ROI" style={{ ...COL.roi, textAlign: "right" as const }} />
              <TableHeaderCell label="Multiple" style={{ ...COL.mult, textAlign: "right" as const }} />
            </View>

            {/* Investor rows */}
            {isWaterfall
              ? waterfallOutput?.investorResults.map((r, i) => (
                  <View key={r.investor.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                    <Text style={[s.tableCellBold, COL.name]}>{r.investor.name}</Text>
                    <Text style={[s.tableCellMuted, COL.capital, { textAlign: "right" as const }]}>{usd(r.investor.contribution)}</Text>
                    <Text style={[s.tableCellMuted, COL.equity, { textAlign: "right" as const }]}>{fmt2(r.effectiveEquityPct)}%</Text>
                    {wfTier1Enabled && <Text style={[s.tableCellMuted, COL.tier, { textAlign: "right" as const }]}>{usd(r.tier1_roc)}</Text>}
                    <Text style={[s.tableCellMuted, COL.tier, { textAlign: "right" as const }]}>{usd(r.tier2_pref)}</Text>
                    <Text style={[s.tableCellMuted, COL.tier, { textAlign: "right" as const }]}>{usd(r.tier4_lp)}</Text>
                    <Text style={[s.tableCellBold, COL.total, { textAlign: "right" as const }]}>{usd(r.total)}</Text>
                    <Text style={[r.netReturn >= 0 ? s.tableCellGreen : s.tableCellRed, COL.net, { textAlign: "right" as const }]}>{usd(r.netReturn)}</Text>
                    <Text style={[r.roi >= 0 ? s.tableCellGreen : s.tableCellRed, COL.roi, { textAlign: "right" as const }]}>{pct2(r.roi)}</Text>
                    <Text style={[s.tableCell, COL.mult, { textAlign: "right" as const }]}>{fmt2(r.multiple)}x</Text>
                  </View>
                ))
              : simpleResults.map((r, i) => (
                  <View key={r.investor.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                    <Text style={[s.tableCellBold, COL.name]}>{r.investor.name}</Text>
                    <Text style={[s.tableCellMuted, COL.capital, { textAlign: "right" as const }]}>{usd(r.investor.contribution)}</Text>
                    <Text style={[s.tableCellMuted, COL.equity, { textAlign: "right" as const }]}>{fmt2(r.effectiveEquityPct)}%</Text>
                    {showPrefColumns && (
                      <>
                        <Text style={[s.tableCellMuted, COL.tier, { textAlign: "right" as const }]}>{usd(r.prefReturnAmount)}</Text>
                        <Text style={[s.tableCellMuted, COL.tier, { textAlign: "right" as const }]}>{usd(r.proRataAmount)}</Text>
                      </>
                    )}
                    <Text style={[s.tableCellBold, COL.total, { textAlign: "right" as const }]}>{usd(r.total)}</Text>
                    <Text style={[r.netReturn >= 0 ? s.tableCellGreen : s.tableCellRed, COL.net, { textAlign: "right" as const }]}>{usd(r.netReturn)}</Text>
                    <Text style={[r.roi >= 0 ? s.tableCellGreen : s.tableCellRed, COL.roi, { textAlign: "right" as const }]}>{pct2(r.roi)}</Text>
                    <Text style={[s.tableCell, COL.mult, { textAlign: "right" as const }]}>{fmt2(r.multiple)}x</Text>
                  </View>
                ))
            }

            {/* GP row (waterfall) */}
            {isWaterfall && waterfallOutput && waterfallOutput.gp.total > 0 && (
              <View style={[s.tableRow, s.tableRowGP]}>
                <Text style={[s.tableCellAmber, COL.name]}>{waterfallOutput.gp.name} (GP)</Text>
                <Text style={[s.tableCellMuted, COL.capital, { textAlign: "right" as const }]}>—</Text>
                <Text style={[s.tableCellMuted, COL.equity, { textAlign: "right" as const }]}>—</Text>
                {wfTier1Enabled && <Text style={[s.tableCellMuted, COL.tier, { textAlign: "right" as const }]}>—</Text>}
                <Text style={[s.tableCellAmber, COL.tier, { textAlign: "right" as const }]}>{wfCatchupEnabled ? usd(waterfallOutput.gp.tier3_catchup) : "—"}</Text>
                <Text style={[s.tableCellAmber, COL.tier, { textAlign: "right" as const }]}>{usd(waterfallOutput.gp.tier4_gp)}</Text>
                <Text style={[s.tableCellAmber, COL.total, { textAlign: "right" as const }]}>{usd(waterfallOutput.gp.total)}</Text>
                <Text style={[s.tableCellMuted, COL.net, { textAlign: "right" as const }]}>Carried Interest</Text>
                <Text style={[s.tableCellMuted, COL.roi, { textAlign: "right" as const }]}>—</Text>
                <Text style={[s.tableCellMuted, COL.mult, { textAlign: "right" as const }]}>—</Text>
              </View>
            )}

            {/* Totals row */}
            <View style={[s.tableRow, s.tableRowTotal]}>
              <Text style={[s.tableCellBold, COL.name]}>Total ({isWaterfall ? (waterfallOutput?.investorResults.length ?? 0) : simpleResults.length} investors)</Text>
              <Text style={[s.tableCellBold, COL.capital, { textAlign: "right" as const }]}>{usd(totalContributions)}</Text>
              <Text style={[s.tableCellBold, COL.equity, { textAlign: "right" as const }]}>100%</Text>
              {isWaterfall ? (
                <>
                  {wfTier1Enabled && <Text style={[s.tableCellBold, COL.tier, { textAlign: "right" as const }]}>{usd(waterfallOutput?.tiers.t1 ?? 0)}</Text>}
                  <Text style={[s.tableCellBold, COL.tier, { textAlign: "right" as const }]}>{usd(waterfallOutput?.tiers.t2 ?? 0)}</Text>
                  <Text style={[s.tableCellBold, COL.tier, { textAlign: "right" as const }]}>{usd(waterfallOutput?.tiers.t4_lp ?? 0)}</Text>
                </>
              ) : showPrefColumns ? (
                <>
                  <Text style={[s.tableCellBold, COL.tier, { textAlign: "right" as const }]}>{usd(simpleResults.reduce((s, r) => s + r.prefReturnAmount, 0))}</Text>
                  <Text style={[s.tableCellBold, COL.tier, { textAlign: "right" as const }]}>{usd(simpleResults.reduce((s, r) => s + r.proRataAmount, 0))}</Text>
                </>
              ) : null}
              <Text style={[s.tableCellBold, COL.total, { textAlign: "right" as const }]}>{usd(lpDistributed)}</Text>
              <Text style={[lpDistributed - totalContributions >= 0 ? s.tableCellGreen : s.tableCellRed, COL.net, { textAlign: "right" as const }]}>{usd(lpDistributed - totalContributions)}</Text>
              <Text style={[overallROI >= 0 ? s.tableCellGreen : s.tableCellRed, COL.roi, { textAlign: "right" as const }]}>{pct2(overallROI)}</Text>
              <Text style={[s.tableCellBold, COL.mult, { textAlign: "right" as const }]}>{fmt2(overallMultiple)}x</Text>
            </View>
          </View>

          {/* Notes */}
          {notes.trim() && (
            <>
              <Text style={s.sectionLabel}>Notes</Text>
              <View style={s.notesBox}>
                <Text style={s.notesText}>{notes}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Prepared with PropHound  ·  {generatedDate}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────

export async function downloadDistributionPDF(props: DistributionPDFProps): Promise<void> {
  const blob = await pdf(<DistributionDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (props.projectName ?? "distribution").replace(/\s+/g, "-").toLowerCase();
  a.download = `distribution-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

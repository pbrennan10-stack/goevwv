import { ImageResponse } from "next/og";
import { planCatalog } from "@/lib/planCatalog";
import { rangeWords, upfrontWords, usd, verdictFromLink, verdictSentence, type Verdict } from "@/lib/planVerdict";

// The preview image for a shared plan link (/plan?h=…): the verdict card's
// sentence and its three numbers, drawn from the same functions as the page.
// A link without a finished plan gets the general planner card instead.
//
// Node runtime, not edge: the verdict needs the data files, read with fs.
// (@vercel/og's Node build looks its font up with fileURLToPath, which can
// fail on a Windows dev machine; production is Linux, where it works.)
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };
const GREEN = "#059669", INK = "#0f172a", MUTED = "#475569", SOFT = "#64748b";
const SAVES = "#065f46", COSTS = "#92400e";

export async function GET(req: Request): Promise<Response> {
  let v: Verdict | null = null;
  try {
    v = verdictFromLink(new URL(req.url).searchParams.get("h"), planCatalog());
  } catch {
    v = null;
  }
  return new ImageResponse(v ? <PlanCard v={v} /> : <GeneralCard />, {
    ...SIZE,
    // A given link's card only changes when the data files do (a deploy).
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}

function Frame({ children, footer }: { children: React.ReactNode; footer: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff", padding: "56px 72px 48px", fontFamily: "sans-serif", color: INK, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, backgroundColor: GREEN }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 44, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
          <span>Go</span>
          <span style={{ color: GREEN }}>EV</span>
          <span>&nbsp;WV</span>
        </div>
        <div style={{ fontSize: 24, color: MUTED }}>Household plan · West Virginia</div>
      </div>
      {children}
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 26, color: GREEN, fontWeight: 700 }}>goevwv.com/plan</div>
        <div style={{ fontSize: 20, color: SOFT }}>{footer}</div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f8fafc", borderRadius: 16, padding: "18px 22px" }}>
      <div style={{ fontSize: 21, color: SOFT }}>{label}</div>
      <div style={{ fontSize: value.length > 18 ? 27 : 38, fontWeight: 800, lineHeight: 1.15, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: sub.length > 26 ? 18 : 20, color: SOFT, marginTop: 6, lineHeight: 1.25 }}>{sub}</div>
    </div>
  );
}

function PlanCard({ v }: { v: Verdict }) {
  return (
    <Frame footer="Purchase price, WV sales tax, resale and running costs included">
      <div style={{ display: "flex", marginTop: 34, fontSize: 52, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em", color: v.saving >= 0 ? SAVES : COSTS }}>
        {verdictSentence(v)}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 30 }}>
        <Tile label="Each month" value={`${usd(Math.abs(v.monthlyRunSaving))} ${v.monthlyRunSaving >= 0 ? "less" : "more"}`} sub={`to run than ${v.vsGas ? v.otherLabel : "today"}`} />
        <Tile label="Up front" value={usd(v.upfront)} sub={upfrontWords(v)} />
        <Tile label={`Over ${v.years} years`} value={rangeWords(v)} sub={v.range ? "depending on resale" : v.isUsed ? "resale is one estimate" : "middle estimate"} />
      </div>
      <div style={{ display: "flex", marginTop: 30, fontSize: 24, color: MUTED, lineHeight: 1.3 }}>
        Someone else&apos;s driveway and driving — your numbers will differ. Try yours in a few minutes.
      </div>
    </Frame>
  );
}

function GeneralCard() {
  return (
    <Frame footer="Honest EV math for West Virginia">
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44, fontSize: 60, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        <span>Plan your household,</span>
        <span style={{ color: GREEN }}>not just one car</span>
      </div>
      <div style={{ display: "flex", marginTop: 30, fontSize: 30, color: MUTED, lineHeight: 1.35, maxWidth: 1000 }}>
        Who drives where, the trips you take, and what an EV would cost your household — purchase price, WV sales tax, resale and running costs.
      </div>
    </Frame>
  );
}

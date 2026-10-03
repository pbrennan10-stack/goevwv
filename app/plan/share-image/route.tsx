import { ImageResponse } from "next/og";
import { CARD_HEADERS, CARD_SIZE, COSTS, Frame, GREEN, MUTED, SAVES, Tile } from "@/components/ShareCard";
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

export async function GET(req: Request): Promise<Response> {
  let v: Verdict | null = null;
  try {
    v = verdictFromLink(new URL(req.url).searchParams.get("h"), planCatalog());
  } catch {
    v = null;
  }
  return new ImageResponse(v ? <PlanCard v={v} /> : <GeneralCard />, { ...CARD_SIZE, headers: CARD_HEADERS });
}

function PlanCard({ v }: { v: Verdict }) {
  return (
    <Frame kicker="Household plan · West Virginia" path="goevwv.com/plan" footer="Purchase price, WV sales tax, resale and running costs included">
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
    <Frame kicker="Household plan · West Virginia" path="goevwv.com/plan" footer="Honest EV math for West Virginia">
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

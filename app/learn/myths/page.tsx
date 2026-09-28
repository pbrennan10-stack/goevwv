import type { Metadata } from "next";
import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { Term } from "@/components/Term";
import { getFederalData, getOwnershipAssumptions, getUtilities, getVehicles, getWearData } from "@/lib/data";
import { CO2_KG_PER_KWH_WV_GRID } from "@/lib/calc";
import { typicalFigures } from "@/lib/typical";

export const metadata: Metadata = {
  title: "EV myths, checked with West Virginia numbers",
  description: "Coal power, battery life, winter, hills, insurance, and resale: common claims about electric cars in WV, rated true, partly true, or not true.",
  alternates: { canonical: "/learn/myths" },
};

type Verdict = "True" | "Partly true" | "Not true";
const TONE: Record<Verdict, string> = {
  "True": "bg-emerald-100 text-emerald-900",
  "Partly true": "bg-amber-100 text-amber-900",
  "Not true": "bg-rose-100 text-rose-900",
};

function Myth({ claim, verdict, children }: { claim: string; verdict: Verdict; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h2 className="!mt-0 text-lg">&ldquo;{claim}&rdquo;</h2>
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[verdict]}`}>{verdict}</span>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export default function Page() {
  const fed = getFederalData();
  const own = getOwnershipAssumptions();
  const wear = getWearData();
  const tf = typicalFigures(fed, getUtilities(), getVehicles());
  const co2Pct = Math.round((1 - tf.evCo2KgPerMi / tf.gasCo2KgPerMi) * 100);
  // Worst case: every kWh from coal (EIA WV in-state rate, 0.87 kg/kWh).
  const coalPct = Math.round((1 - (tf.evCo2KgPerMi / CO2_KG_PER_KWH_WV_GRID) * 0.87 / tf.gasCo2KgPerMi) * 100);
  const after8 = Math.round(300 * (1 - (wear.battery.fade_per_year_pct / 100) * 8));
  const r = own.retention_scenarios_5yr;
  const pct = (x: number) => Math.round(x * 100);
  return (
    <LearnLayout slug="myths" title="EV myths, checked"
      intro={<>Some things you hear about electric cars are true, some are out of date, and some were never true. Here&apos;s each one with the numbers we use.</>}>
      <div className="space-y-4">
        <Myth claim="WV runs on coal, so an EV is just as dirty." verdict="Not true">
          <p>
            WV sits on the regional PJM grid, which mixes coal, gas, nuclear and renewables. On that mix, a typical EV
            puts out about <strong>{co2Pct}% less CO₂ per mile</strong> than a 25-mpg gas car, winter included. Even
            if every kWh came from coal, it would still come out about {coalPct}% lower.
          </p>
        </Myth>
        <Myth claim="The battery dies after a few years and costs a fortune." verdict="Not true">
          <p>
            Batteries lose about {wear.battery.fade_per_year_pct}% of their range a year on average, and the battery carries a
            warranty of {wear.battery.warranty}. Replacements outside recalls are rare. After 8 years, at that
            pace a 300-mile EV still has about {after8} miles of range.
          </p>
        </Myth>
        <Myth claim="You'll get stranded in the cold." verdict="Partly true">
          <p>
            Cold really does cost range — about a quarter on a freezing day. But you start every morning full if you charge
            at home, and most daily drives use a small slice of the battery. Stranding risk is about long winter trips,
            which take planning. <Link href="/learn/winter" className="text-brand hover:underline">More on winter</Link>.
          </p>
        </Myth>
        <Myth claim="EVs can't handle WV hills." verdict="Not true">
          <p>
            Climbing uses extra energy in any car. Going back down, an EV recovers some of it with{" "}
            <Term id="one-pedal">regenerative braking</Term>, which a gas car can&apos;t do. Steep round trips cost some
            range, but less than people expect. Electric motors also have full pulling power from a standstill.
          </p>
        </Myth>
        <Myth claim="EVs cost more to insure." verdict="Partly true">
          <p>
            Insurance mostly follows the car&apos;s price. An EV priced like a gas car costs about the same to insure.
            Some brands (Tesla, Rivian, Lucid, Polestar) cost more because of their repair networks. We add 15% for
            those brands in our math.
          </p>
        </Myth>
        <Myth claim="EVs lose value faster." verdict="Partly true">
          <p>
            Early EVs did, partly because the $7,500 tax credit and big Tesla price cuts pushed down what used ones sold
            for. After 5 years we assume an EV keeps {pct(r.bev.low)}–{pct(r.bev.high)}% of its list price, against{" "}
            {pct(r.gas.low)}–{pct(r.gas.high)}% for a gas car. The credit is gone and 2026 used-EV prices have firmed, so
            we show a range rather than one number.
          </p>
        </Myth>
        <Myth claim="There's a big tax credit for buying one." verdict="Not true">
          <p>
            Not anymore. The federal $7,500 credit ended for vehicles bought after September 30, 2025, and the home-charger
            credit ended June 30, 2026. Some WV utilities still offer charger rebates — see{" "}
            <Link href="/learn/charging-at-home" className="text-brand hover:underline">charging at home</Link>.
          </p>
        </Myth>
        <Myth claim="Charging is cheaper than gas." verdict="Partly true">
          <p>
            Charging at home costs about ${tf.homePer100.toFixed(2)} per 100 miles, against ${tf.gasPer100.toFixed(2)} in
            a 25-mpg car. But fast charging on the road costs about ${tf.publicPer100.toFixed(2)} — more than gas. Your mix
            of home and road charging decides the savings.
          </p>
        </Myth>
      </div>
    </LearnLayout>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CHART_COLORS, HBars } from "@/components/charts";
import { LearnLayout } from "@/components/LearnLayout";
import { Term } from "@/components/Term";
import { HYBRID_WINTER_FUEL_MULTIPLIER } from "@/lib/calc";
import { getFederalData, getUtilities, getVehicles } from "@/lib/data";
import { $2, typicalFigures } from "@/lib/typical";

export const metadata: Metadata = {
  title: "Hybrid, plug-in hybrid, or fully electric? Which fits a WV driver",
  description: "The difference between a hybrid, a plug-in hybrid, and an electric car, what each costs per 100 miles in West Virginia, and which fits how you drive.",
  alternates: { canonical: "/learn/hybrid-plug-in-or-electric" },
};

// A typical current compact hybrid (RAV4/CR-V/Camry hybrid class).
const HYBRID_MPG = 40;

export default function Page() {
  const fed = getFederalData();
  const vehicles = getVehicles();
  const tf = typicalFigures(fed, getUtilities(), vehicles);
  const hybridPer100 = (100 / HYBRID_MPG) * HYBRID_WINTER_FUEL_MULTIPLIER * tf.gasPrice;
  const phevs = vehicles
    .filter((v) => v.powertrain === "phev" && v.status === "current" && v.epa_range_mi_electric)
    .map((v) => v.epa_range_mi_electric!)
    .sort((a, b) => a - b);
  const phevMedian = phevs[Math.floor(phevs.length / 2)];
  const fees = fed.wv_state_fees;
  return (
    <LearnLayout slug="hybrid-plug-in-or-electric" title="Hybrid, plug-in hybrid, or fully electric?"
      intro={<>Three kinds of &ldquo;electrified&rdquo; car, three different trade-offs. The right one depends mostly on two things: whether you can plug in at home, and how far you drive in a day.</>}>
      <section>
        <h2>The three types</h2>
        <ul>
          <li>
            <strong><Term id="hybrid">Hybrid</Term></strong> (Prius, RAV4 Hybrid): a gas car with a small battery that
            recharges itself. You never plug it in. It just uses less gas.
          </li>
          <li>
            <strong><Term id="phev">Plug-in hybrid</Term></strong> (RAV4 Prime, Tucson Plug-in): a bigger battery you
            charge at home, good for about {phevMedian} miles on electricity (median of the models we list), then it runs
            as a hybrid. Two drivetrains, so two sets of upkeep.
          </li>
          <li>
            <strong><Term id="bev">Fully electric</Term></strong> (Model Y, Equinox EV): battery only. No gas, no oil
            changes, cheapest per mile — but long trips need{" "}
            <Link href="/learn/road-trips" className="text-brand hover:underline">charging stops</Link>.
          </li>
        </ul>
      </section>
      <section>
        <h2>What 100 miles costs</h2>
        <p className="text-sm text-ink-muted">Averaged over a WV year, winter included. Gas at {$2(tf.gasPrice)}/gal.</p>
        <div className="mt-3">
          <HBars ariaLabel={`100 miles costs about ${$2(tf.gasPer100)} in a 25-mpg gas car, ${$2(hybridPer100)} in a hybrid, ${$2(tf.homePer100)} on electricity at home, and ${$2(tf.publicPer100)} at a fast charger.`}
            rows={[
              { label: "Gas car (25 mpg)", value: tf.gasPer100, valueLabel: $2(tf.gasPer100), color: CHART_COLORS.gas },
              { label: `Hybrid (${HYBRID_MPG} mpg)`, value: hybridPer100, valueLabel: $2(hybridPer100), color: CHART_COLORS.gas },
              { label: "Electric miles, charged at home", value: tf.homePer100, valueLabel: $2(tf.homePer100), color: CHART_COLORS.ev },
              { label: "Electric miles, fast charger", value: tf.publicPer100, valueLabel: $2(tf.publicPer100), color: CHART_COLORS.neutral },
            ]} />
        </div>
        <p className="text-sm text-ink-muted">
          A plug-in hybrid costs the electric rate for miles on battery and the hybrid rate after. WV also charges an
          annual fee: ${fees.bev_annual_fee.amount_usd} for an EV, ${fees.phev_annual_fee.amount_usd} for a plug-in hybrid,
          nothing for a regular hybrid.
        </p>
      </section>
      <section>
        <h2>Which one fits you</h2>
        <ul>
          <li><strong>Can&apos;t plug in at home?</strong> A regular hybrid is usually the best money-saver. Plug-ins lose most of their advantage if you rely on public charging.</li>
          <li><strong>Can plug in, and most days are under {phevMedian} miles, but you drive long rural trips often?</strong> A plug-in hybrid runs your daily driving on electricity with no range worries.</li>
          <li><strong>Can plug in, and your longest regular drive fits a car&apos;s winter range?</strong> A fully electric car costs the least to run and maintain.</li>
          <li><strong>Two cars in the driveway?</strong> Many households pair one EV for daily driving with a gas or hybrid car for the long trips.</li>
        </ul>
        <p>
          The <Link href="/plan" className="text-brand hover:underline">household planner</Link> tries each option against
          your actual week and trips.
        </p>
      </section>
    </LearnLayout>
  );
}

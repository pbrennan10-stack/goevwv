import type { Metadata } from "next";
import Link from "next/link";
import { CHART_COLORS, HBars } from "@/components/charts";
import { LearnLayout } from "@/components/LearnLayout";
import { Term } from "@/components/Term";
import { getFederalData, getOwnershipAssumptions, getUtilities, getVehicles } from "@/lib/data";
import { $0, $2, typicalFigures } from "@/lib/typical";

export const metadata: Metadata = {
  title: "Charging an EV at home in West Virginia: outlet vs Level 2, costs, renters",
  description: "Can you charge an electric car from a regular outlet? What a Level 2 charger costs in WV, utility rebates, off-peak rates, and what renters without a driveway pay.",
  alternates: { canonical: "/learn/charging-at-home" },
};

export default function Page() {
  const fed = getFederalData(), utilities = getUtilities(), own = getOwnershipAssumptions();
  const t = typicalFigures(fed, utilities, getVehicles());
  const setup = own.home_charging_setup;
  const rebates = utilities.flatMap((u) => u.rebates.filter((r) => r.type === "l2_charger").map((r) => ({ u, r })));
  const tou = utilities.filter((u) => u.residential.tou_available && u.residential.tou_schedule);
  return (
    <LearnLayout slug="charging-at-home" title="Charging at home"
      intro={<>Most EV charging happens in your driveway overnight — like a phone. Where you charge matters more than which EV you buy.</>}>
      <section>
        <h2>What 100 miles costs, by where you charge</h2>
        <HBars ariaLabel={`100 miles costs about ${$2(t.homePer100)} charging at home, ${$2(t.publicPer100)} at public fast chargers, and ${$2(t.gasPer100)} in gas.`}
          rows={[
            { label: "Charging at home", value: t.homePer100, valueLabel: $2(t.homePer100), color: CHART_COLORS.ev, note: `WV utilities charge ${(t.homeLow * 100).toFixed(1)}–${(t.homeHigh * 100).toFixed(1)}¢ per kWh` },
            { label: "Gas (25 mpg)", value: t.gasPer100, valueLabel: $2(t.gasPer100), color: CHART_COLORS.gas, note: `at ${$2(t.gasPrice)}/gal forecast` },
            { label: "Public fast charging", value: t.publicPer100, valueLabel: $2(t.publicPer100), color: CHART_COLORS.neutral, note: `about ${Math.round(t.dcfcRate * 100)}¢ per kWh walk-up` },
          ]} />
        <p className="text-sm text-ink-muted">A typical EV, winter included. If you&apos;d rely on public fast chargers every day, an EV costs about the same as gas or more.</p>
      </section>
      <section>
        <h2>Option 1: a regular outlet — $0</h2>
        <p>Every EV comes with a cord that plugs into a normal 120-volt outlet (<Term id="level1">Level 1</Term>). It&apos;s slow — roughly 3–5 miles of range an hour, about {setup.level1_max_daily_mi} miles overnight — but for a commute under ~{setup.level1_max_daily_mi} miles round trip, many people never need anything else.</p>
        <ul>
          <li>Use a dedicated outlet if you can; avoid extension cords.</li>
          <li>Cold garages and very long days are where it falls short.</li>
        </ul>
      </section>
      <section>
        <h2>Option 2: a Level 2 charger — about {$0(setup.level2_installed_usd)} installed</h2>
        <p>A <Term id="level2">Level 2</Term> charger uses a 240-volt circuit (like a clothes dryer) and refills most EVs overnight. Budget about {$0(setup.level2_installed_usd)} for the charger and an electrician; more if your panel needs an upgrade.</p>
        {rebates.length > 0 && (
          <ul>
            {rebates.map(({ u, r }) => (
              <li key={r.id}><strong>{u.name}</strong>: {r.amount_usd ? `$${r.amount_usd}` : "a"} rebate — {r.name}. <a href={r.url} className="text-brand hover:underline" rel="noopener">Details</a></li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink-muted">The federal home-charger tax credit ended June 30, 2026.</p>
      </section>
      {tou.length > 0 && (
        <section>
          <h2>Cheaper overnight rates</h2>
          <p>{tou.map((u) => u.name).join(" and ")} offer an <Term id="tou">off-peak EV rate</Term>: about {(tou[0].residential.tou_schedule!.off_peak_rate_per_kwh * 100).toFixed(1)}¢ per kWh nights and weekends instead of {(tou[0].residential.flat_rate_per_kwh * 100).toFixed(1)}¢. It needs a Level 2 charger on its own metered circuit. <Link href={`/utilities/${tou[0].id}`} className="text-brand hover:underline">See the details</Link>.</p>
        </section>
      )}
      <section>
        <h2>If you rent or park on the street</h2>
        <p>This is the hardest case, and we don&apos;t sugar-coat it: paying public fast-charging prices for every mile erases most of an EV&apos;s fuel savings. What helps:</p>
        <ul>
          <li>Free or cheap charging at work.</li>
          <li>Asking your landlord about an outlet near your spot — even Level 1 changes the math.</li>
          <li>A plug-in hybrid, which runs on gas when there&apos;s nowhere to plug in.</li>
        </ul>
        <p>The <Link href="/plan" className="text-brand hover:underline">household planner</Link> has a &ldquo;can&apos;t charge at home&rdquo; option that prices every mile at public rates.</p>
      </section>
    </LearnLayout>
  );
}

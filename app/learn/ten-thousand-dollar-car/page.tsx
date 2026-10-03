import type { Metadata } from "next";
import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { getHouseholdBudget } from "@/lib/data";
import { planCatalog } from "@/lib/planCatalog";
import { WHAT_IF_PRICE, cheapestNewEv, whatIfCases } from "@/lib/tenK";
import { $0 } from "@/lib/typical";

export const metadata: Metadata = {
  title: "What a $10,000 car would do to a West Virginia household's budget",
  description:
    "Transportation is the second-largest household expense. The cheapest EV in the world costs about $10,000 in China. What that price would mean for a typical West Virginia household, run through our planner, and why the car isn't sold here.",
  alternates: { canonical: "/learn/ten-thousand-dollar-car" },
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function Page() {
  const b = getHouseholdBudget();
  const cat = planCatalog();
  const cases = whatIfCases(cat);
  const cheap = cheapestNewEv(cat);
  const cheapList = cheap.msrp_usd + (cheap.destination_usd ?? 1500);
  const income = b.wv_median_household_income.amount_usd;
  const bls = b.bls_consumer_expenditures;
  const keep = cases.find((c) => c.key === "keep")!;
  const ev = cases.find((c) => c.key === "ev")!;
  const tenk = cases.find((c) => c.key === "tenk")!;
  const gapVsEv = (ev.totalPerMonth - tenk.totalPerMonth) * 12;
  const gapVsKeep = (keep.totalPerMonth - tenk.totalPerMonth) * 12;
  const price = $0(WHAT_IF_PRICE);

  return (
    <LearnLayout slug="ten-thousand-dollar-car" title={`What a ${price} car would do to your budget`}
      intro={<>The cheapest electric car in the world costs about {$0(b.cheapest_ev_abroad.price_usd_approx)} in China. Here is what that price would mean for a typical West Virginia household, run through the same engine as our <Link href="/plan" className="text-brand hover:underline">household planner</Link>, and why you can&apos;t buy one.</>}>
      <section>
        <h2>Transportation is the second-biggest bill</h2>
        <p>
          American households spent an average of {$0(bls.transportation_per_year)} on transportation in {bls.year}, about {pct(bls.transportation_share)} of
          everything they spent, second only to housing. The car itself is the biggest piece: {$0(bls.vehicle_purchases_per_year)} a year on
          vehicle purchases, before fuel, insurance and repairs. In West Virginia, where the median household earned {$0(income)} in{" "}
          {b.wv_median_household_income.year}, lowest in the country, and where most jobs are a long drive away, the car takes a bigger share than that.
        </p>
      </section>

      <section>
        <h2>The {price} car exists</h2>
        <p>
          {b.cheapest_ev_abroad.name} sells its smallest car in {b.cheapest_ev_abroad.market} from {b.cheapest_ev_abroad.price_yuan.toLocaleString("en-US")} yuan,
          about {$0(b.cheapest_ev_abroad.price_usd_approx)}, before any tariff or shipping. {b.cheapest_ev_abroad.note} The cheapest new
          fully electric car in our data is the {cheap.year} {cheap.make} {cheap.model} at {$0(cheapList)} with destination, about{" "}
          {Math.round(cheapList / b.cheapest_ev_abroad.price_usd_approx)} times the price.
        </p>
        <p>It isn&apos;t sold here, and both parties built the wall:</p>
        <ul>
          {b.import_barriers.map((x) => (
            <li key={x.what}>{x.what} ({x.since}; <a href={x.source_url} className="text-brand hover:underline" rel="noopener">{x.source}</a>).</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>What it would mean for a typical West Virginia household</h2>
        <p>
          The planner&apos;s default household: one commuter driving 21 miles each way, errands, a few road trips a year, Appalachian Power rates,
          five years of ownership, a 60-month loan at the national average rate, and a paid-off gas car worth about {$0(cat.own.default_owned_value_usd)} to
          trade in. Four ways to handle the next car, per month:
        </p>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-ink-soft border-b border-slate-200">
                <th className="py-2 pr-3 font-medium">Per month</th>
                {cases.map((c) => <th key={c.key} className="py-2 px-2 font-medium text-right">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-3">Loan payment</td>
                {cases.map((c) => (
                  <td key={c.key} className="py-2 px-2 text-right">
                    {c.payment > 0 ? $0(c.payment) : c.cashBack > 0 ? <span>none<span className="block text-xs text-ink-soft">trade-in covers it, {$0(c.cashBack)} back</span></span> : "none"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-3">Running costs<span className="block text-xs text-ink-soft">fuel or charging, upkeep, insurance, WV fees</span></td>
                {cases.map((c) => <td key={c.key} className="py-2 px-2 text-right align-top">{$0(c.runningPerMonth)}</td>)}
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pr-3">Value lost<span className="block text-xs text-ink-soft">price minus resale after 5 years, plus loan interest</span></td>
                {cases.map((c) => <td key={c.key} className="py-2 px-2 text-right align-top">{$0(c.lostValuePerMonth)}</td>)}
              </tr>
              <tr className="font-semibold">
                <td className="py-2 pr-3">True cost per month<span className="block text-xs font-normal text-ink-soft">running costs plus value lost</span></td>
                {cases.map((c) => <td key={c.key} className="py-2 px-2 text-right align-top">{$0(c.totalPerMonth)}</td>)}
              </tr>
              <tr className="text-ink-muted">
                <td className="py-2 pr-3">Per year, as a share of the WV median income</td>
                {cases.map((c) => <td key={c.key} className="py-2 px-2 text-right align-top">{$0(c.totalPerYear)} · {pct(c.totalPerYear / income)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="text-sm text-ink-muted">
          {cases.map((c) => <li key={c.key}><strong className="text-ink">{c.label}:</strong> {c.detail}.</li>)}
        </ul>
        <p className="text-sm text-ink-muted">
          The {price} car is given the {cheap.make} {cheap.model}&apos;s efficiency and range, insurance scaled to its price, and the same resale
          behavior as other EVs. The loan payment is cash flow; the true cost counts the car&apos;s lost value instead, so a cheap car that
          needs no loan still has a real cost. Winter, WV sales tax, title and the state&apos;s EV fee are included throughout, the same as in the planner.
        </p>
      </section>

      <section>
        <h2>Where the money goes instead</h2>
        <p>
          Against the cheapest EV sold here, the {price} car frees about {$0(gapVsEv)} a year for this household, {pct(gapVsEv / income)} of the
          median income; against keeping the old gas car, about {$0(gapVsKeep)} a year. That money doesn&apos;t disappear. It goes to rent, groceries,
          debt, savings and local businesses, which is what people mean when they say efficient transportation sends money elsewhere. Across ten
          thousand West Virginia households it would be roughly {$0(gapVsKeep * 10000 / 1e6)} million a year that stays in family budgets instead of
          going to a car.
        </p>
      </section>

      <section>
        <h2>The trade-off nobody should pretend away</h2>
        <p>
          The wall that keeps the {price} car out protects the American battery and auto plants that the{" "}
          <Link href="/about" className="text-brand hover:underline">Why EVs Matter</Link> essay argues for. Cheaper cars now and a domestic
          industry later pull against each other, and both parties chose the industry. The honest conclusion is the same one the essay reaches: the
          only path to an affordable American EV runs through enough American buyers to build the scale that made the Chinese one cheap.
        </p>
        <p>
          <Link href="/plan" className="text-brand hover:underline">Run your own household</Link> with a real price, or try the planner&apos;s used-car option, which is
          the closest thing to a {price} EV you can buy in West Virginia today.
        </p>
      </section>
    </LearnLayout>
  );
}

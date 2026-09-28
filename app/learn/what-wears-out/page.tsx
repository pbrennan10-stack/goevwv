import type { Metadata } from "next";
import Link from "next/link";
import { CHART_COLORS } from "@/components/charts";
import { LearnLayout } from "@/components/LearnLayout";
import { Term } from "@/components/Term";
import { getWearData } from "@/lib/data";
import { $0 } from "@/lib/typical";
import { wearOverPeriod } from "@/lib/wear";

export const metadata: Metadata = {
  title: "What wears out on an EV vs a gas car: 5 years of maintenance",
  description: "Oil, brakes, tires, filters, 12-volt battery: what an electric car and a gas car each need over 5 years and 60,000 miles, with typical costs.",
  alternates: { canonical: "/learn/what-wears-out" },
};

export default function Page() {
  const d = getWearData();
  const { rows, gasTotal, evTotal } = wearOverPeriod(d);
  const max = Math.max(1, ...rows.flatMap((r) => [r.gas?.cost ?? 0, r.ev?.cost ?? 0]));
  const miles = d.horizon_years * d.miles_per_year;
  return (
    <LearnLayout slug="what-wears-out" title="What wears out"
      intro={<>No oil changes is the famous one. But EVs still need tires, brakes, filters, and a 12-volt battery — here&apos;s {d.horizon_years} years and {miles.toLocaleString("en-US")} miles, side by side.</>}>
      <section>
        <h2>{d.horizon_years} years of scheduled maintenance</h2>
        <p className="text-sm text-ink-muted">
          A typical compact SUV at a repair shop.{" "}
          <span className="inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: CHART_COLORS.gas }} /> gas ·{" "}
          <span className="inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: CHART_COLORS.ev }} /> electric
        </p>
        <div className="chart mt-3 space-y-4">
          <p className="sr-only">{`Over ${d.horizon_years} years, scheduled maintenance costs about ${$0(gasTotal)} for a gas SUV and ${$0(evTotal)} for an electric one.`}</p>
          {rows.map((r) => (
            <div key={r.item}>
              <div className="text-sm font-medium text-ink">{r.item}</div>
              {(["gas", "ev"] as const).map((k) => {
                const x = r[k];
                return (
                  <div key={k} className="mt-1 flex items-center gap-2">
                    <div aria-hidden className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      {x && x.cost > 0 && (
                        <div className="h-full rounded-full" style={{ width: `${(x.cost / max) * 100}%`, background: k === "gas" ? CHART_COLORS.gas : CHART_COLORS.ev }} />
                      )}
                    </div>
                    <span className="w-40 shrink-0 text-xs text-ink tabular-nums">
                      {k === "gas" ? "Gas" : "EV"}: {x == null ? "not needed" : x.times === 0 ? "not due yet" : `${x.times}× · ${$0(x.cost)}`}
                    </span>
                  </div>
                );
              })}
              {r.note && <p className="mt-1 text-xs text-ink-soft">{r.note}</p>}
            </div>
          ))}
        </div>
        <p className="mt-4 font-semibold">Total: gas {$0(gasTotal)} · electric {$0(evTotal)} over {d.horizon_years} years.</p>
        <p className="text-sm text-ink-muted">
          Scheduled items only, at shop prices. Older cars add repairs as the miles climb — the{" "}
          <Link href="/plan" className="text-brand hover:underline">planner</Link> accounts for that when you keep a car.
        </p>
      </section>
      <section>
        <h2>The big EV-only part: the battery</h2>
        <p>
          The main battery carries a warranty of {d.battery.warranty}. Real-world data shows batteries losing about{" "}
          {d.battery.fade_per_year_pct}% of their range a year on average, and replacements outside recalls are rare.{" "}
          <Term id="one-pedal">Regenerative braking</Term> is why EV brake pads last so much longer.
        </p>
      </section>
      <section>
        <h2>Sources</h2>
        <ul className="text-sm">
          {[...d.sources, ...d.battery.sources].map((s) => (
            <li key={s}><a href={s} className="text-brand hover:underline break-all" rel="noopener">{s}</a></li>
          ))}
        </ul>
      </section>
    </LearnLayout>
  );
}

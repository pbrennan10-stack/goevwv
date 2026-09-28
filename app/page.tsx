import Link from "next/link";
import { AiDataNotice } from "@/components/AiDataNotice";
import { CHART_COLORS, HBars } from "@/components/charts";
import { QuickAnswer } from "@/components/QuickAnswer";
import { SiteHeader } from "@/components/SiteHeader";
import { Term } from "@/components/Term";
import { ANNUAL_WINTER_KWH_MULTIPLIER, ICE_WINTER_FUEL_MULTIPLIER } from "@/lib/calc";
import { getFederalData, getIceVehicles, getOwnershipAssumptions, getUtilities, getVehicles } from "@/lib/data";
import type { Catalog } from "@/lib/household";

// What 100 miles costs in WV — computed from the data files so it updates
// itself with every refresh. Median current-EV efficiency, winter included on
// both sides, gas at the forecast average.
function per100(fed: ReturnType<typeof getFederalData>, utilities: ReturnType<typeof getUtilities>, evs: ReturnType<typeof getVehicles>) {
  const effs = evs.filter((v) => v.powertrain === "bev" && v.status === "current" && v.class !== "van")
    .map((v) => v.efficiency_kwh_per_100mi).sort((a, b) => a - b);
  const medianKwh = effs[Math.floor(effs.length / 2)] * ANNUAL_WINTER_KWH_MULTIPLIER;
  const gas = fed.calculation_notes.gas_price_outlook_per_gal?.mid ?? fed.calculation_notes.gas_price_baseline_per_gal.current;
  const rates = utilities.filter((u) => u.id !== "rural_coops").map((u) => u.residential.flat_rate_per_kwh);
  const home = (Math.min(...rates) + Math.max(...rates)) / 2;
  const dcfc = fed.calculation_notes.dcfc_rate_per_kwh?.current ?? 0.55;
  return {
    gas: (100 / 25) * ICE_WINTER_FUEL_MULTIPLIER * gas, gasPrice: gas,
    home: medianKwh * home, homeRate: home,
    publicFast: medianKwh * dcfc, dcfcRate: dcfc,
  };
}

export default function HomePage() {
  const fed = getFederalData();
  const utilities = getUtilities();
  const evs = getVehicles();
  const c = per100(fed, utilities, evs);
  const catalog: Catalog = {
    evs: evs.filter((v) => v.status === "current").map((v) => ({ ...v, notes: "", capability_note: undefined, capability_source: undefined })),
    ice: getIceVehicles().filter((v) => ["toyota-camry-2024", "honda-crv-2024", "honda-odyssey-2024", "chevy-silverado-2024"].includes(v.id))
      .map((v) => ({ ...v, capability_note: undefined, capability_source: undefined, price_note: undefined })),
    utilities, fed, own: getOwnershipAssumptions(),
  };
  const $ = (n: number) => "$" + n.toFixed(2);
  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader />

      <section className="mb-10 sm:mb-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
          Is an EV right for you{" "}
          <span className="text-brand">in West Virginia?</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-ink-muted max-w-prose">
          Honest numbers for how you actually drive. EVs are cheap to run on
          the long commutes West Virginians rack up — and they have real
          drawbacks too: cold-weather range, towing, and few fast chargers in
          rural areas. We count both.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
            <h2 className="font-bold text-ink">What 100 miles costs in West Virginia</h2>
            <p className="text-xs text-ink-soft mb-3">A typical EV vs a 25-mpg gas car, winter included</p>
            <HBars
              ariaLabel={`100 miles costs about ${$(c.gas)} in gas, ${$(c.home)} charging at home, and ${$(c.publicFast)} at public fast chargers.`}
              rows={[
                { label: "Gas", value: c.gas, valueLabel: $(c.gas), color: CHART_COLORS.gas, note: `at ${$(c.gasPrice)}/gal (forecast average)` },
                { label: <>Charging at home (<Term id="kwh">per kWh</Term>)</>, value: c.home, valueLabel: $(c.home), color: CHART_COLORS.ev, note: `at ~${(c.homeRate * 100).toFixed(0)}¢ per kWh (WV utilities)` },
                { label: <Term id="fast-charger">Public fast charger</Term>, value: c.publicFast, valueLabel: $(c.publicFast), color: CHART_COLORS.neutral, note: `at ~${(c.dcfcRate * 100).toFixed(0)}¢ per kWh — mostly on road trips` },
              ]}
            />
            <p className="mt-3 text-xs text-ink-soft">Where you charge matters more than which EV you pick.</p>
          </div>
          <div className="flex flex-col gap-3">
            <a href="#quick" className="inline-flex items-center justify-center rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-3 transition shadow-sm">
              Get a quick answer — 4 taps ↓
            </a>
            <Link href="/plan" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:border-brand text-ink font-semibold px-5 py-3 transition">
              Plan your whole household →
            </Link>
            <p className="text-sm text-ink-soft">No sign-up, nothing stored. Every number is sourced on <Link href="/state-of-the-data" className="text-brand hover:underline">State of the Data</Link>.</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-soft max-w-prose">
          Why I built this:{" "}
          <Link
            href="/about"
            className="font-medium text-brand hover:underline"
          >
            the case for EV adoption in the USA →
          </Link>
        </p>
      </section>

      <QuickAnswer catalog={catalog} />

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        {[
          { href: "/plan", title: "Plan your household", body: "Two cars, different drivers, road trips and towing — see what an EV would really cost, purchase price included." },
          { href: "/ev", title: "Browse every EV", body: "Winter range, charging cost, and yearly savings for every model sold in WV." },
          { href: "/utilities", title: "Your utility's EV rates", body: "Appalachian Power, Mon Power, Potomac Edison, Wheeling Power — rates and rebates." },
          { href: "/faq", title: "Quick answers", body: "The $200 WV fee, what happened to tax credits, chargers, hills, and cold." },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-brand transition"
          >
            <h2 className="font-bold text-ink">{c.title} →</h2>
            <p className="mt-1 text-sm text-ink-muted">{c.body}</p>
          </Link>
        ))}
      </section>

      <footer className="mt-16 pb-8 border-t border-slate-200 pt-6 text-sm text-ink-soft">
        <p>
          GoEV WV is an independent, non-commercial project. Numbers are
          estimates based on publicly filed utility rates, EPA vehicle data,
          and IRS rules; not financial advice. Data reviewed quarterly — see
          the{" "}
          <Link href="/state-of-the-data" className="text-brand hover:underline">
            State of the Data
          </Link>{" "}
          page for every source and retrieval date.
        </p>
        <AiDataNotice className="mt-3" />
        <p className="mt-3 text-xs">
          &copy; {new Date().getFullYear()} GoEV WV. Built by Patrick Brennan in West Virginia.
        </p>
      </footer>
    </main>
  );
}

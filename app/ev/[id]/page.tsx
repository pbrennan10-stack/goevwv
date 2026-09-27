import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fmtNum, fmtUSD } from "@/lib/calc";
import { capabilitySpecs } from "@/lib/capability";
import { getFederalData, getUtilities, getVehicles } from "@/lib/data";
import {
  STATUS_LABEL,
  TYPICAL,
  calculatorHref,
  costPer100Mi,
  fmtCents,
  powertrainLabel,
  typicalScenario,
  vehicleName,
} from "@/lib/scenario";

// One static page per vehicle. These exist so people searching things like
// "Equinox EV West Virginia" or "Model Y winter range WV" land on a page
// with real WV numbers, then click through to the calculator.

export function generateStaticParams() {
  return getVehicles().map((v) => ({ id: v.id }));
}

export const dynamicParams = false;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const v = getVehicles().find((x) => x.id === id);
  if (!v) return {};
  const name = `${v.year} ${vehicleName(v)}`;
  const aep = getUtilities().find((u) => u.id === "aep");
  const per100 = aep ? costPer100Mi(v, aep.residential.flat_rate_per_kwh) : null;
  const range =
    v.powertrain === "bev" && v.winter_range_mi
      ? ` WV winter range ~${v.winter_range_mi} mi.`
      : v.epa_range_mi_electric
        ? ` ${v.epa_range_mi_electric} mi electric range.`
        : "";
  return {
    title: `${name} in West Virginia: charging cost, winter range & savings`,
    description:
      `What the ${name} really costs to run in West Virginia.` +
      (per100 && v.powertrain === "bev"
        ? ` About ${fmtUSD(per100)} per 100 miles charging at home on Appalachian Power.`
        : "") +
      range +
      " Includes WV's EV fee and every utility's rates.",
    alternates: { canonical: `/ev/${v.id}` },
  };
}

export default async function VehiclePage({ params }: Params) {
  const { id } = await params;
  const vehicles = getVehicles();
  const v = vehicles.find((x) => x.id === id);
  if (!v) notFound();

  const fed = getFederalData();
  const utilities = getUtilities();
  const name = `${v.year} ${vehicleName(v)}`;
  const gas = fed.calculation_notes.gas_price_baseline_per_gal;

  const rows = utilities.map((u) => {
    const s = typicalScenario([v], u, fed);
    return { utility: u, scenario: s, r: s.results[0] };
  });
  const aepRow = rows.find((x) => x.utility.id === "aep") ?? rows[0];
  const r = aepRow.r;
  const s = aepRow.scenario;

  const siblings = v.variant_group
    ? vehicles.filter((x) => x.variant_group === v.variant_group && x.id !== v.id)
    : [];
  const similar = vehicles
    .filter(
      (x) =>
        x.class === v.class &&
        x.id !== v.id &&
        x.variant_group !== v.variant_group &&
        x.status !== "discontinued" &&
        (x.variant_primary || !x.variant_group),
    )
    .sort((a, b) => Math.abs(a.msrp_usd - v.msrp_usd) - Math.abs(b.msrp_usd - v.msrp_usd))
    .slice(0, 4);

  const specs: [string, string][] = [
    ["Type", powertrainLabel(v)],
    ["Starting MSRP", `${fmtUSD(v.msrp_usd)} (before destination)`],
  ];
  if (v.powertrain === "bev") {
    if (v.epa_range_mi) specs.push(["EPA range", `${v.epa_range_mi} mi`]);
    if (v.winter_range_mi)
      specs.push(["WV winter estimate", `~${v.winter_range_mi} mi`]);
    if (v.highway_range_mi)
      specs.push(["Realistic 70 mph highway range", `~${v.highway_range_mi} mi`]);
  } else {
    if (v.epa_range_mi_electric)
      specs.push(["Electric range (EPA)", `${v.epa_range_mi_electric} mi`]);
    if (v.efficiency_mpg_hybrid)
      specs.push(["Hybrid mode", `${v.efficiency_mpg_hybrid} mpg`]);
  }
  specs.push(["Efficiency", `${v.efficiency_kwh_per_100mi} kWh / 100 mi`]);
  if (v.battery_kwh) specs.push(["Battery", `${v.battery_kwh} kWh`]);
  if (v.charging.dcfc_10_to_80_min)
    specs.push([
      "Fast charge 10→80%",
      `~${v.charging.dcfc_10_to_80_min} min (${v.charging.dcfc_peak_kw} kW peak)`,
    ]);
  specs.push(["Charge port", v.charging.connector_dcfc]);
  specs.push(...capabilitySpecs(v));
  if (v.zero_to_sixty_s) specs.push(["0–60 mph", `${v.zero_to_sixty_s} s`]);
  if (v.assembly_location) specs.push(["Built in", v.assembly_location]);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://goevwv.com" },
      { "@type": "ListItem", position: 2, name: "EVs", item: "https://goevwv.com/ev" },
      { "@type": "ListItem", position: 3, name, item: `https://goevwv.com/ev/${v.id}` },
    ],
  };

  const fee = r.annual_state_fee_usd;
  const saves = s.current_annual_gas_cost - (r.annual_energy_cost_usd + fee);

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <SiteHeader active="/ev" />

      <nav className="text-sm text-ink-soft mb-4" aria-label="Breadcrumb">
        <Link href="/ev" className="hover:underline">EVs</Link>
        <span className="mx-1">›</span>
        <span>{vehicleName(v)}</span>
      </nav>

      <article className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
          The {name} <span className="text-brand">in West Virginia</span>
        </h1>
        {v.status && v.status !== "current" && (
          <p className="mt-3 inline-block rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm text-amber-900">
            <strong>{STATUS_LABEL[v.status]}.</strong>
            {v.status_note ? ` ${v.status_note}` : ""}
          </p>
        )}

        <section className="mt-6 rounded-2xl bg-brand-bg border border-brand/20 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-ink">
            For a typical WV commuter on Appalachian Power
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {TYPICAL.daily_round_trip_mi} miles a day, {TYPICAL.days_per_week} days a week,
            plus {TYPICAL.long_trips_per_year} round trips of {TYPICAL.long_trip_one_way_mi} miles
            each way — about {fmtNum(s.annual_miles)} miles a year — compared with a{" "}
            {TYPICAL.mpg} mpg car at {fmtCents(gas.current)}/gal ({gas.retrieved_label ?? "current"} AAA WV average).
            Winter range loss included.
          </p>
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat
              label={v.powertrain === "phev" ? "Electricity + gas / yr" : "Charging / yr"}
              value={fmtUSD(r.annual_energy_cost_usd)}
            />
            <Stat label="WV EV fee / yr" value={fmtUSD(fee)} />
            <Stat label="Gas car fuel / yr" value={fmtUSD(s.current_annual_gas_cost)} />
            <Stat
              label={saves >= 0 ? "You'd save / yr" : "You'd pay more / yr"}
              value={fmtUSD(Math.abs(saves))}
              highlight
            />
          </dl>
          <p className="mt-3 text-xs text-ink-soft">
            Fuel and state fees only. Insurance, maintenance, and purchase price
            are in the full calculator.
          </p>
          <Link
            href={calculatorHref([v.id])}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-3 text-sm transition shadow-sm"
          >
            Run it with your commute →
          </Link>
        </section>

        {r.warnings.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-amber-900">
            {r.warnings.map((w) => (
              <li key={w} className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">{w}</li>
            ))}
          </ul>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-bold text-ink">Cost to run it by utility</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Same typical driver, standard residential rate. Long trips are
            charged at public fast chargers.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Utility</th>
                  <th className="py-2 pr-4 font-medium">Home rate</th>
                  {v.powertrain === "bev" && (
                    <th className="py-2 pr-4 font-medium">Per 100 mi at home</th>
                  )}
                  <th className="py-2 font-medium">Energy / yr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ utility: u, r: ur }) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      {u.id === "rural_coops" ? (
                        u.name
                      ) : (
                        <Link href={`/utilities/${u.id}`} className="text-brand hover:underline">
                          {u.name}
                        </Link>
                      )}
                    </td>
                    <td className="py-2 pr-4">{(u.residential.flat_rate_per_kwh * 100).toFixed(1)}¢/kWh</td>
                    {v.powertrain === "bev" && (
                      <td className="py-2 pr-4">
                        {fmtCents(costPer100Mi(v, u.residential.flat_rate_per_kwh))}
                      </td>
                    )}
                    <td className="py-2">{fmtUSD(ur.annual_energy_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-ink">Key specs</h2>
          <dl className="mt-3 grid sm:grid-cols-2 gap-x-8">
            {specs.map(([k, val]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="text-ink font-medium text-right">{val}</dd>
              </div>
            ))}
          </dl>
          {v.powertrain === "bev" && v.winter_range_mi && v.epa_range_mi && (
            <p className="mt-3 text-sm text-ink-muted">
              Why the winter number is lower: batteries lose range in the cold,
              and heating the cabin uses energy. We knock about 28% off the EPA
              figure for a January morning in the mountains. That still leaves{" "}
              {v.winter_range_mi} miles — about{" "}
              {Math.floor(v.winter_range_mi / TYPICAL.daily_round_trip_mi)} days of a{" "}
              {TYPICAL.daily_round_trip_mi}-mile commute on one charge.
            </p>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            Federal EV tax credits ended for vehicles bought after September 30, 2025.{" "}
            <Link href="/faq" className="text-brand hover:underline">More in the FAQ</Link>.
            Sources for every number are on{" "}
            <Link href="/state-of-the-data" className="text-brand hover:underline">State of the Data</Link>.
          </p>
        </section>

        {siblings.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">Other versions</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {siblings.map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/ev/${x.id}`}
                    className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-brand"
                  >
                    {vehicleName(x)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">Compare with similar vehicles</h2>
            <ul className="mt-3 grid sm:grid-cols-2 gap-3">
              {similar.map((x) => (
                <li key={x.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <Link href={`/ev/${x.id}`} className="font-semibold text-ink hover:text-brand">
                    {x.year} {vehicleName(x)}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {fmtUSD(x.msrp_usd)} · {powertrainLabel(x)}
                    {x.winter_range_mi ? ` · ~${x.winter_range_mi} mi winter` : ""}
                  </p>
                  <Link
                    href={calculatorHref([v.id, x.id])}
                    className="mt-1 inline-block text-sm text-brand hover:underline"
                  >
                    Compare side by side →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <SiteFooter />
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className={`text-xl font-bold ${highlight ? "text-brand" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

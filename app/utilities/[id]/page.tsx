import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fmtUSD } from "@/lib/calc";
import { getFederalData, getUtilities, getVehicles } from "@/lib/data";
import { TYPICAL, calculatorHref, costPer100Mi, typicalScenario, vehicleName, fmtCents } from "@/lib/scenario";
import type { Utility } from "@/lib/types";

// One page per investor-owned utility: EV charging rate, TOU option,
// rebates, and what a year of charging costs. Answers searches like
// "Appalachian Power EV rate" or "Mon Power electric car charging cost".
// Co-ops are an aggregate with unverified rates, so they don't get a page.

function pageUtilities(): Utility[] {
  return getUtilities().filter((u) => u.id !== "rural_coops");
}

export function generateStaticParams() {
  return pageUtilities().map((u) => ({ id: u.id }));
}

export const dynamicParams = false;

type Params = { params: Promise<{ id: string }> };

const cents = (n: number) => `${(n * 100).toFixed(1)}¢`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const u = pageUtilities().find((x) => x.id === id);
  if (!u) return {};
  const r = u.residential;
  return {
    title: `${u.name} EV charging rates, rebates & cost (West Virginia)`,
    description:
      `Charging an electric car on ${u.name} in West Virginia: ${cents(r.flat_rate_per_kwh)}/kWh at home` +
      (r.tou_available && r.tou_schedule
        ? `, ${cents(r.tou_schedule.off_peak_rate_per_kwh)} off-peak on the EV rate`
        : "") +
      (u.rebates.length ? `, plus ${u.rebates.length} rebate${u.rebates.length > 1 ? "s" : ""}` : "") +
      ". See what a year of charging costs for popular EVs.",
    alternates: { canonical: `/utilities/${u.id}` },
  };
}

// Well-known models shown in the example table (falls back gracefully if an
// id is ever retired from the catalog).
const EXAMPLE_IDS = [
  "chevy-equinox-ev-2025",
  "tesla-model-y-2025",
  "hyundai-ioniq-5-2025",
  "chevy-bolt-2027",
  "ford-f150-lightning-2025",
  "chevy-silverado-ev-2025",
  "toyota-rav4-prime-2025",
];

export default async function UtilityPage({ params }: Params) {
  const { id } = await params;
  const u = pageUtilities().find((x) => x.id === id);
  if (!u) notFound();

  const fed = getFederalData();
  const all = getVehicles();
  const examples = EXAMPLE_IDS.map((vid) => all.find((v) => v.id === vid)).filter(
    (v): v is NonNullable<typeof v> => !!v,
  );
  const s = typicalScenario(examples, u, fed);
  const r = u.residential;
  const touMeterYr = (r.tou_monthly_meter_charge ?? 0) * 12;
  // Off-peak savings for the typical driver, using the first example vehicle's
  // home-charged kWh (DCFC road-trip energy isn't billed by the utility).
  const refResult = s.results[0];
  const touSavingsYr =
    r.tou_schedule && refResult
      ? (refResult.kwh_per_year - refResult.annual_dcfc_kwh) *
        (r.flat_rate_per_kwh - r.tou_schedule.off_peak_rate_per_kwh)
      : 0;

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader active="/utilities" />
      <nav className="text-sm text-ink-soft mb-4" aria-label="Breadcrumb">
        <Link href="/utilities" className="hover:underline">Utilities</Link>
        <span className="mx-1">›</span>
        <span>{u.name}</span>
      </nav>

      <article className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
          Charging an EV on <span className="text-brand">{u.name}</span>
        </h1>
        <p className="mt-3 text-base text-ink-muted">
          {u.name} serves {u.service_area.charAt(0).toLowerCase() + u.service_area.slice(1)}. Here&apos;s what it
          costs to charge an electric car at home on its residential rates, and
          which programs can lower the bill.
        </p>

        <section className="mt-6 grid sm:grid-cols-3 gap-4">
          <Card label="Standard home rate" value={`${cents(r.flat_rate_per_kwh)}/kWh`}
            note="Marginal rate incl. riders, before local taxes" />
          <Card
            label="EV time-of-use rate"
            value={r.tou_available && r.tou_schedule ? `${cents(r.tou_schedule.off_peak_rate_per_kwh)}/kWh` : "Not offered"}
            note={r.tou_available && r.tou_schedule ? "Off-peak, on an EV submeter — no monthly fee" : "No residential EV rate in WV"}
          />
          <Card
            label="Rebates"
            value={u.rebates.length ? u.rebates.map((x) => (x.amount_usd ? fmtUSD(x.amount_usd) : "Varies")).join(" + ") : "None right now"}
            note={u.rebates.length ? u.rebates.map((x) => x.name).join(", ") : "We re-check every quarter"}
          />
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-ink">What a year of charging costs</h2>
          <p className="mt-1 text-sm text-ink-muted">
            A typical WV driver: {TYPICAL.daily_round_trip_mi} miles a day,{" "}
            {TYPICAL.days_per_week} days a week, plus {TYPICAL.long_trips_per_year} long
            road trips — about {Math.round(s.annual_miles).toLocaleString()} miles a year,
            winter included. Compared with a {TYPICAL.mpg} mpg car, which would spend{" "}
            <strong>{fmtUSD(s.current_annual_gas_cost)}</strong> on gas.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Vehicle</th>
                  <th className="py-2 pr-4 font-medium">Per 100 mi</th>
                  <th className="py-2 pr-4 font-medium">Energy / yr</th>
                  <th className="py-2 font-medium">Saves / yr*</th>
                </tr>
              </thead>
              <tbody>
                {s.results.map((x) => {
                  const saves = s.current_annual_gas_cost - (x.annual_energy_cost_usd + x.annual_state_fee_usd);
                  return (
                    <tr key={x.vehicle.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">
                        <Link href={`/ev/${x.vehicle.id}`} className="text-brand hover:underline">
                          {vehicleName(x.vehicle)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        {x.vehicle.powertrain === "bev" ? fmtCents(costPer100Mi(x.vehicle, r.flat_rate_per_kwh)) : "—"}
                      </td>
                      <td className="py-2 pr-4">{fmtUSD(x.annual_energy_cost_usd)}</td>
                      <td className="py-2 font-medium text-brand">{fmtUSD(saves)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            *After WV&apos;s annual EV fee (${fed.wv_state_fees.bev_annual_fee.amount_usd} electric,
            ${fed.wv_state_fees.phev_annual_fee.amount_usd} plug-in hybrid). Long trips use public
            fast chargers. Insurance and maintenance are in the full calculator.
          </p>
          <Link
            href={calculatorHref(examples.slice(0, 3).map((v) => v.id), u.id)}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-3 text-sm transition shadow-sm"
          >
            Run it with your commute →
          </Link>
        </section>

        {r.tou_available && r.tou_schedule && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">
              Is the {r.tou_program_name ?? "EV time-of-use rate"} worth it?
            </h2>
            <p className="mt-2 text-ink-muted">
              Off-peak ({r.tou_schedule.off_peak_hours}) is{" "}
              {cents(r.tou_schedule.off_peak_rate_per_kwh)}/kWh versus{" "}
              {cents(r.tou_schedule.on_peak_rate_per_kwh)} on-peak.
              {r.tou_requires_separate_meter &&
                (touMeterYr
                  ? ` It requires a separate EV meter, which an electrician installs and which carries its own ${fmtUSD(touMeterYr / 12)}/month charge (${fmtUSD(touMeterYr)}/yr).`
                  : " Your charger goes on its own circuit with an EV submeter installed behind your house meter. There's no monthly fee for it; the only cost is a one-time electrician install and inspection.")}
            </p>
            {touMeterYr === 0 && (
              <p className="mt-2 text-ink-muted">
                Each off-peak kWh saves{" "}
                {cents(r.flat_rate_per_kwh - r.tou_schedule.off_peak_rate_per_kwh)}. For the typical
                driver above, charging overnight and on weekends saves about{" "}
                <strong>{fmtUSD(touSavingsYr)} a year</strong> versus the standard rate — more if you
                drive more. Whether it&apos;s worth it comes down to how quickly that pays back the
                electrician&apos;s bill. The calculator&apos;s time-of-use option shows your number.
              </p>
            )}
            {touMeterYr > 0 && (
              <p className="mt-2 text-ink-muted">
                Each kWh saves {cents(r.flat_rate_per_kwh - r.tou_schedule.off_peak_rate_per_kwh)}, so
                the meter charge only pays for itself above roughly{" "}
                <strong>
                  {(Math.round(touMeterYr / (r.flat_rate_per_kwh - r.tou_schedule.off_peak_rate_per_kwh) / 100) * 100).toLocaleString()} kWh
                </strong>{" "}
                a year of home charging — around{" "}
                {(Math.round(touMeterYr / (r.flat_rate_per_kwh - r.tou_schedule.off_peak_rate_per_kwh) / 0.33 / 1000) * 1000).toLocaleString()}{" "}
                EV miles. For most commuters the standard rate is simpler and about the same cost.
              </p>
            )}
            {r.tou_url && (
              <p className="mt-2 text-sm">
                <a href={r.tou_url} className="text-brand hover:underline" rel="noopener">
                  {u.name}&apos;s program page →
                </a>
              </p>
            )}
          </section>
        )}

        {u.rebates.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">Rebates</h2>
            <ul className="mt-3 space-y-4">
              {u.rebates.map((rb) => (
                <li key={rb.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-ink">
                    {rb.name}
                    {rb.amount_usd ? ` — ${fmtUSD(rb.amount_usd)}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">{rb.description}</p>
                  {rb.eligibility && (
                    <ul className="mt-2 list-disc pl-5 text-sm text-ink-muted">
                      {rb.eligibility.map((e) => <li key={e}>{e}</li>)}
                    </ul>
                  )}
                  <a href={rb.url} className="mt-2 inline-block text-sm text-brand hover:underline" rel="noopener">
                    Program details →
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 text-sm text-ink-muted">
          <h2 className="text-xl font-bold text-ink">Contact</h2>
          <p className="mt-2">
            <a href={u.website} className="text-brand hover:underline" rel="noopener">{u.website.replace(/^https?:\/\//, "")}</a>
            {u.customer_service_phone ? ` · ${u.customer_service_phone}` : ""}
          </p>
          <p className="mt-3 text-xs text-ink-soft">
            Rates come from tariffs filed with the WV Public Service Commission. See{" "}
            <Link href="/state-of-the-data" className="text-brand hover:underline">State of the Data</Link>{" "}
            for the exact sheet and date. Other utilities:{" "}
            {pageUtilities().filter((x) => x.id !== u.id).map((x, i) => (
              <span key={x.id}>
                {i > 0 && ", "}
                <Link href={`/utilities/${x.id}`} className="text-brand hover:underline">{x.name}</Link>
              </span>
            ))}
            .
          </p>
        </section>
      </article>

      <SiteFooter />
    </main>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{note}</p>
    </div>
  );
}

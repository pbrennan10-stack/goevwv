import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fmtUSD } from "@/lib/calc";
import { getChargingInfra, getFederalData, getUtilities, getVehicles } from "@/lib/data";
import { costPer100Mi, fmtCents } from "@/lib/scenario";

// Plain-language answers to the questions West Virginians actually search
// for. Every number is read from data/*, so the answers stay current with
// the quarterly refresh. The FAQPage JSON-LD lets Google show these as
// expandable answers in search results.

export const metadata: Metadata = {
  title: "West Virginia EV FAQ: fees, tax credits, charging cost, winter range",
  description:
    "Straight answers for WV drivers: the $200 EV registration fee, whether federal EV tax credits still exist, what charging costs on WV utilities, winter range, and charger coverage.",
  alternates: { canonical: "/faq" },
};

interface QA {
  q: string;
  a: string; // plain text — used for both the page and the JSON-LD
  more?: { href: string; label: string };
}

function buildFaq(): QA[] {
  const fed = getFederalData();
  const utilities = getUtilities().filter((u) => u.id !== "rural_coops");
  const infra = getChargingInfra();
  const ref = getVehicles().find((v) => v.id === "chevy-equinox-ev-2025");
  const gas = fed.calculation_notes.gas_price_baseline_per_gal;
  const fees = fed.wv_state_fees;
  const base = fees.standard_registration_fee?.amount_usd ?? 0;
  const bev = fees.bev_annual_fee.amount_usd;
  const phev = fees.phev_annual_fee.amount_usd;
  const rates = utilities.map((u) => u.residential.flat_rate_per_kwh);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  const dcfc = fed.calculation_notes.dcfc_rate_per_kwh?.current;
  const ss = infra.statewide_summary;
  const aep = utilities.find((u) => u.id === "aep");
  const aepRebate = aep?.rebates[0];
  const gasPer100 = (100 / 25) * gas.current;

  const out: QA[] = [
    {
      q: "How much is the West Virginia EV registration fee?",
      a: `West Virginia charges battery-electric vehicles a $${bev} annual surcharge on top of the regular $${base.toFixed(2)} registration, for $${(base + bev).toFixed(2)} a year. Plug-in hybrids pay a $${phev} surcharge ($${(base + phev).toFixed(2)} total). The fee is meant to replace the gas tax EV drivers don't pay. A 2026 bill to double it did not pass. Our calculator includes the fee in every result.`,
      more: { href: "/calculator", label: "See it in your numbers" },
    },
    {
      q: "Is there still a federal tax credit for buying an EV?",
      a: "No. The federal new-EV credit (up to $7,500) and used-EV credit (up to $4,000) ended for vehicles bought after September 30, 2025, and the home-charger credit ended for equipment installed after June 30, 2026. Some dealers and manufacturers still offer their own discounts, so it's worth asking.",
    },
    {
      q: "How much does it cost to charge an electric car in West Virginia?",
      a: ref
        ? `Home electricity on West Virginia's big utilities runs about ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}¢ per kWh. For a typical compact electric SUV like the ${ref.make} ${ref.model}, that's roughly ${fmtCents(costPer100Mi(ref, lo))}–${fmtCents(costPer100Mi(ref, hi))} per 100 miles with winter losses included. A 25 mpg gas car at ${fmtCents(gas.current)}/gal spends about ${fmtCents(gasPer100)} per 100 miles.${dcfc ? ` Public fast chargers cost more — about ${Math.round(dcfc * 100)}¢/kWh — but most drivers use them only on road trips.` : ""}`
        : `Home electricity on West Virginia's big utilities runs about ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}¢ per kWh.`,
      more: { href: "/utilities", label: "Rates for each utility" },
    },
    {
      q: "How much range do EVs lose in a West Virginia winter?",
      a: "On a cold morning, expect about 25–30% less range than the EPA number, mostly from heating the cabin and a cold battery. Averaged over a whole year, that works out to about 12% more electricity. We show a winter range estimate for every vehicle, and the calculator includes the winter penalty by default.",
      more: { href: "/ev", label: "Winter range for every model" },
    },
    {
      q: "Are there enough EV chargers in West Virginia?",
      a: `West Virginia has roughly ${ss.public_ports_approx} public charging ports, including about ${ss.dcfc_ports_approx} fast-charging ports at ${ss.dcfc_sites_approx} locations (${ss.as_of}). Interstates are reasonably covered; many rural two-lane routes are not. Federally funded fast chargers along the interstates aren't open yet — the first are expected ${infra.nevi_status.estimated_stations_open.replace(/\s*\(.*\)/, "")}. Nearly all everyday charging happens at home, so public chargers matter most for road trips.`,
      more: { href: "/chargers", label: "Open the charger map" },
    },
    {
      q: "Do I need a Level 2 charger at home?",
      a: "Not always. A regular 120-volt outlet (Level 1) adds about 3–5 miles of range per hour — roughly 40–50 miles overnight, which covers many West Virginia commutes. A 240-volt Level 2 charger adds 25–40 miles per hour and is worth it for long commutes, cold winters, or two EVs. Installation usually runs several hundred to a couple thousand dollars depending on your panel.",
    },
  ];

  if (aep?.residential.tou_available && aep.residential.tou_schedule) {
    const t = aep.residential.tou_schedule;
    out.push({
      q: "Does Appalachian Power have a special EV charging rate?",
      a: `Yes. ${aep.residential.tou_program_name ?? "Its EV time-of-use rate"} charges ${(t.off_peak_rate_per_kwh * 100).toFixed(1)}¢/kWh off-peak (${t.off_peak_hours}) instead of ${(aep.residential.flat_rate_per_kwh * 100).toFixed(1)}¢. ${(aep.residential.tou_monthly_meter_charge ?? 0) > 0 ? `It requires a separate meter with its own $${aep.residential.tou_monthly_meter_charge}/month charge, so it only pays off if you charge a lot.` : "Your charger gets an EV submeter installed behind the house meter. There's no monthly fee, just a one-time electrician install, so if you charge overnight and on weekends it saves about 4¢ on every kWh."} Wheeling Power (also an AEP company) offers the same program; Mon Power and Potomac Edison don't offer an EV rate in West Virginia.`,
      more: { href: "/utilities/aep", label: "Appalachian Power details" },
    });
  }

  if (aepRebate?.amount_usd) {
    out.push({
      q: "Are there rebates for EV chargers in West Virginia?",
      a: `Appalachian Power customers can get a $${aepRebate.amount_usd} rebate on an ENERGY STAR certified Level 2 home charger. We haven't found a current home-charger rebate from Mon Power, Potomac Edison, or the state. We re-check every quarter.`,
      more: { href: "/utilities", label: "All utility programs" },
    });
  }

  out.push(
    {
      q: "Can an EV handle West Virginia's hills?",
      a: "Yes. Climbing uses extra energy, but EVs recover much of it going back down through regenerative braking — around 70% on most models. Hilly commutes cost a little more range than flat ones, but rarely enough to matter day to day. If you enter your actual route in the calculator, it accounts for the elevation.",
    },
    {
      q: "Is an EV cheaper than a gas car in West Virginia?",
      a: "For most commuters, running costs are lower: electricity per mile costs a fraction of gas, and there are no oil changes. The $200 annual fee eats into that, so drivers who put on very few miles may save little. Purchase price, insurance, and resale matter too. The honest answer depends on how far you drive — which is why we built the calculator.",
      more: { href: "/calculator", label: "Get your numbers" },
    },
  );

  return out;
}

export default function FaqPage() {
  const faq = buildFaq();
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <SiteHeader active="/faq" />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
        EV questions, <span className="text-brand">answered for West Virginia</span>
      </h1>
      <p className="mt-3 text-base text-ink-muted max-w-prose">
        Short, sourced answers. Numbers update whenever we refresh our data.
      </p>

      <div className="mt-8 max-w-3xl space-y-3">
        {faq.map((x) => (
          <details key={x.q} className="group rounded-xl border border-slate-200 bg-white p-4 open:shadow-sm">
            <summary className="cursor-pointer list-none font-semibold text-ink flex justify-between gap-4">
              <h2 className="text-base">{x.q}</h2>
              <span className="text-brand group-open:rotate-45 transition" aria-hidden>+</span>
            </summary>
            <p className="mt-3 text-ink-muted">{x.a}</p>
            {x.more && (
              <Link href={x.more.href} className="mt-2 inline-block text-sm text-brand hover:underline">
                {x.more.label} →
              </Link>
            )}
          </details>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}

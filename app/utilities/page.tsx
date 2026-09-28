import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fmtUSD } from "@/lib/calc";
import { getFederalData, getUtilities, getVehicles } from "@/lib/data";
import { comparisonGasPrice, costPer100Mi, fmtCents } from "@/lib/scenario";

export const metadata: Metadata = {
  title: "West Virginia electric utility EV charging rates",
  description:
    "Side-by-side EV charging rates for Appalachian Power, Mon Power, Potomac Edison, Wheeling Power, and WV co-ops: cost per kWh, cost per 100 miles, time-of-use options, and rebates.",
  alternates: { canonical: "/utilities" },
};

export default function UtilitiesIndexPage() {
  const utilities = getUtilities();
  const gas = comparisonGasPrice(getFederalData());
  // Reference vehicle for "per 100 miles": a mainstream compact EV SUV.
  const ref = getVehicles().find((v) => v.id === "chevy-equinox-ev-2025");

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader active="/utilities" />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
        EV charging rates <span className="text-brand">by WV utility</span>
      </h1>
      <p className="mt-3 text-base text-ink-muted max-w-prose">
        Most EV charging happens overnight at home, so your electric utility
        sets most of your &ldquo;fuel&rdquo; price. These are the marginal
        residential rates — what one more kilowatt-hour actually costs once
        your regular household use is covered — taken from tariffs filed with
        the WV Public Service Commission.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft border-b border-slate-200">
              <th className="py-2 pr-4 font-medium">Utility</th>
              <th className="py-2 pr-4 font-medium">Home rate</th>
              {ref && <th className="py-2 pr-4 font-medium">Per 100 mi*</th>}
              <th className="py-2 pr-4 font-medium">EV time-of-use</th>
              <th className="py-2 font-medium">Rebates</th>
            </tr>
          </thead>
          <tbody>
            {utilities.map((u) => {
              const r = u.residential;
              const isCoop = u.id === "rural_coops";
              return (
                <tr key={u.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4">
                    {isCoop ? (
                      <span className="font-medium">{u.name}</span>
                    ) : (
                      <Link href={`/utilities/${u.id}`} className="text-brand font-medium hover:underline">
                        {u.name}
                      </Link>
                    )}
                    <span className="block text-xs text-ink-soft">{u.service_area}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {(r.flat_rate_per_kwh * 100).toFixed(1)}¢/kWh{isCoop ? " (est.)" : ""}
                  </td>
                  {ref && <td className="py-2 pr-4">{fmtCents(costPer100Mi(ref, r.flat_rate_per_kwh))}</td>}
                  <td className="py-2 pr-4">
                    {r.tou_available && r.tou_schedule
                      ? `${(r.tou_schedule.off_peak_rate_per_kwh * 100).toFixed(1)}¢ off-peak`
                      : "—"}
                  </td>
                  <td className="py-2">
                    {u.rebates.length
                      ? u.rebates.map((x) => `${x.amount_usd ? fmtUSD(x.amount_usd) : ""} ${x.type === "l2_charger" ? "charger" : ""}`.trim()).join(", ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ref && (
        <p className="mt-2 text-xs text-ink-soft">
          *For a {ref.make} {ref.model} ({ref.efficiency_kwh_per_100mi} kWh/100 mi), with
          winter losses averaged in. For comparison, a 25 mpg gas car at {fmtCents(gas)}/gal
          spends {fmtCents((100 / 25) * gas)} per 100 miles.
        </p>
      )}
      <p className="mt-6 text-sm text-ink-muted max-w-prose">
        Not sure which utility you have? Check the name at the top of your
        electric bill. Co-op and municipal rates vary and haven&apos;t all been
        verified — call your co-op for the exact number and enter it in the{" "}
        <Link href="/calculator" className="text-brand hover:underline">calculator</Link>.
      </p>

      <SiteFooter />
    </main>
  );
}

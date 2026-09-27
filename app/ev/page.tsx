import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fmtUSD } from "@/lib/calc";
import { cargoMilesPerKwh, cargoSeatsUpLabel, medianIndex } from "@/lib/capability";
import { getFederalData, getUtilities, getVehicles } from "@/lib/data";
import { TYPICAL, costPer100Mi, powertrainLabel, typicalScenario, vehicleName, fmtCents } from "@/lib/scenario";
import type { VehicleClass } from "@/lib/types";

export const metadata: Metadata = {
  title: "Every EV and plug-in hybrid, priced for West Virginia",
  description:
    "Electric cars, SUVs, and trucks sold in West Virginia, with WV winter range, home charging cost on Appalachian Power and Mon Power, and yearly savings versus gas.",
  alternates: { canonical: "/ev" },
};

const CLASS_ORDER: [VehicleClass, string][] = [
  ["suv", "SUVs & crossovers"],
  ["truck", "Pickup trucks"],
  ["sedan", "Sedans"],
  ["hatchback", "Hatchbacks"],
  ["minivan", "Minivans"],
  ["other", "Other"],
];

export default function EvIndexPage() {
  const vehicles = getVehicles();
  const fed = getFederalData();
  const aep = getUtilities().find((u) => u.id === "aep")!;
  const scenario = typicalScenario(vehicles, aep, fed);
  const byId = new Map(scenario.results.map((r) => [r.vehicle.id, r]));
  const cargoIndex = medianIndex(vehicles.map(cargoMilesPerKwh));

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader active="/ev" />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
        EVs and plug-in hybrids <span className="text-brand">for West Virginia</span>
      </h1>
      <p className="mt-3 text-base text-ink-muted max-w-prose">
        Every model in our catalog, with the numbers that matter here: range
        on a cold morning, what a year of charging costs on Appalachian Power,
        how much luggage fits with every seat in use, and how that compares with a {TYPICAL.mpg} mpg gas car for a{" "}
        {TYPICAL.daily_round_trip_mi}-mile daily commute. Savings include WV&apos;s
        annual EV fee. Tap any vehicle for the details.
      </p>
      <p className="mt-3 text-sm text-ink-muted max-w-prose">
        <strong className="text-ink">Cargo-miles index</strong> combines luggage
        room with efficiency: cubic feet of space (every seat full, including
        any front trunk and under-floor storage) times miles per kWh. It&apos;s
        the passenger-car version of the ton-miles-per-gallon figure freight
        haulers use. 100 is the median vehicle here; 130 means about 30% more
        luggage carried per unit of electricity. Pickups use a bed, so they
        aren&apos;t scored.
      </p>

      {CLASS_ORDER.map(([cls, label]) => {
        const list = vehicles
          .filter((v) => v.class === cls)
          .sort(
            (a, b) =>
              Number(a.status === "discontinued") - Number(b.status === "discontinued") ||
              a.msrp_usd - b.msrp_usd,
          );
        if (list.length === 0) return null;
        return (
          <section key={cls} className="mt-10">
            <h2 className="text-xl font-bold text-ink">{label}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-soft border-b border-slate-200">
                    <th className="py-2 pr-4 font-medium">Vehicle</th>
                    <th className="py-2 pr-4 font-medium">MSRP</th>
                    <th className="py-2 pr-4 font-medium">WV winter range</th>
                    <th className="py-2 pr-4 font-medium">Seats · luggage room</th>
                    <th className="py-2 pr-4 font-medium">Cargo-miles index</th>
                    <th className="py-2 pr-4 font-medium">Per 100 mi (AEP)</th>
                    <th className="py-2 font-medium">Saves / yr vs gas</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((v) => {
                    const r = byId.get(v.id)!;
                    const saves =
                      scenario.current_annual_gas_cost -
                      (r.annual_energy_cost_usd + r.annual_state_fee_usd);
                    return (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4">
                          <Link href={`/ev/${v.id}`} className="text-brand font-medium hover:underline">
                            {vehicleName(v)}
                          </Link>
                          <span className="block text-xs text-ink-soft">
                            {v.year} · {powertrainLabel(v)}
                            {v.status === "discontinued" ? " · used only" : ""}
                            {v.status === "final_year" ? " · final year" : ""}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{fmtUSD(v.msrp_usd)}</td>
                        <td className="py-2 pr-4">
                          {v.powertrain === "bev"
                            ? v.winter_range_mi ? `~${v.winter_range_mi} mi` : "—"
                            : v.winter_range_mi_electric
                              ? `~${v.winter_range_mi_electric} mi electric`
                              : v.epa_range_mi_electric
                                ? `${v.epa_range_mi_electric} mi electric`
                                : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {v.seats}
                          {cargoSeatsUpLabel(v) ? ` · ${cargoSeatsUpLabel(v)}` : ""}
                        </td>
                        <td className="py-2 pr-4">{cargoIndex(cargoMilesPerKwh(v)) ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {v.powertrain === "bev"
                            ? fmtCents(costPer100Mi(v, aep.residential.flat_rate_per_kwh))
                            : "—"}
                        </td>
                        <td className={`py-2 font-medium ${saves >= 0 ? "text-brand" : "text-ink"}`}>
                          {saves >= 0 ? fmtUSD(saves) : `−${fmtUSD(-saves)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className="mt-8 text-sm text-ink-soft max-w-prose">
        Fuel and state fees only, for a typical driver. Your commute, utility,
        and current car change the answer —{" "}
        <Link href="/calculator" className="text-brand hover:underline">
          run your own numbers
        </Link>
        .
      </p>

      <SiteFooter />
    </main>
  );
}

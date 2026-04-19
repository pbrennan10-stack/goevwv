import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "@/components/Calculator";
import { ChargingStatus } from "@/components/ChargingStatus";
import { Logo } from "@/components/Logo";
import {
  getChargingInfra,
  getFederalData,
  getIceVehicles,
  getUtilities,
  getVehicles,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "EV Cost Calculator",
  description:
    "Enter your commute, pick up to three EVs or PHEVs, and see WV-specific numbers on charging cost, annual savings, winter range, and 5-year total cost of ownership.",
};

export default function CalculatorPage() {
  const vehicles = getVehicles();
  const iceVehicles = getIceVehicles();
  const utilities = getUtilities();
  const federal = getFederalData();
  const chargingInfra = getChargingInfra();

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="text-sm text-ink-soft flex items-center">
            <Link href="/" className="hover:text-ink transition px-2 py-2">
              Home
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/calculator"
              className="text-brand font-semibold transition px-2 py-2"
            >
              Calculator
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/chargers" className="hover:text-ink transition px-2 py-2">
              Charger Map
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/about" className="hover:text-ink transition px-2 py-2">
              Why EVs Matter
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/state-of-the-data"
              className="hover:text-ink transition px-2 py-2"
            >
              State of the Data
            </Link>
          </nav>
        </div>
      </header>

      <section className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink leading-tight">
          Your WV <span className="text-brand">EV numbers</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-ink-muted max-w-prose">
          Enter your commute and utility, pick up to three vehicles, and see
          charging cost, annual savings, and 5-year total cost of ownership —
          with winter range and the WV EV fee factored in.
        </p>
      </section>

      <Calculator
        vehicles={vehicles}
        iceVehicles={iceVehicles}
        utilities={utilities}
        federal={federal}
        mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      />

      <div className="mt-8">
        <ChargingStatus data={chargingInfra} />
      </div>

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
      </footer>
    </main>
  );
}

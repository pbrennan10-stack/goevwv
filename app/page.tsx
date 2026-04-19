import Link from "next/link";
import { Calculator } from "@/components/Calculator";
import { ChargingStatus } from "@/components/ChargingStatus";
import { FitCheck } from "@/components/FitCheck";
import { Logo } from "@/components/Logo";
import { getChargingInfra, getFederalData, getIceVehicles, getUtilities, getVehicles } from "@/lib/data";

export default function HomePage() {
  const vehicles = getVehicles();
  const iceVehicles = getIceVehicles();
  const utilities = getUtilities();
  const federal = getFederalData();
  const chargingInfra = getChargingInfra();

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Logo className="text-2xl" />
          <nav className="text-sm text-ink-soft flex items-center">
            <a href="#calculator" className="hover:text-ink transition px-2 py-2">
              Calculator
            </a>
            <span className="text-slate-300">·</span>
            <Link href="/about" className="hover:text-ink transition px-2 py-2">
              Why EVs Matter
            </Link>
          </nav>
        </div>
      </header>

      <section className="mb-10 sm:mb-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
          Is an EV right for you{" "}
          <span className="text-brand">in West Virginia?</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-ink-muted max-w-prose">
          A fair, WV-specific look at the numbers. Your utility, our winters,
          realistic highway range, and what daily life actually looks like —
          time at gas stations vs. home charging, long trips that need a
          fast-charge stop vs. ones that don&rsquo;t — so you can decide with
          open eyes.
        </p>
        <p className="mt-4 text-sm text-ink-soft max-w-prose">
          Why I built this:{" "}
          <Link
            href="/about"
            className="font-medium text-brand hover:underline"
          >
            an honest case for EV adoption in WV →
          </Link>
        </p>
      </section>

      <FitCheck />

      <div id="calculator">
        <Calculator
          vehicles={vehicles}
          iceVehicles={iceVehicles}
          utilities={utilities}
          federal={federal}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        />
      </div>

      <div className="mt-8">
        <ChargingStatus data={chargingInfra} />
      </div>

      <footer className="mt-16 pb-8 border-t border-slate-200 pt-6 text-sm text-ink-soft">
        <p>
          GoEV WV is an independent, non-commercial project. Numbers are
          estimates based on publicly filed utility rates, EPA vehicle data,
          and IRS rules; not financial advice. Data reviewed quarterly.
        </p>
      </footer>
    </main>
  );
}

import { Calculator } from "@/components/Calculator";
import { Logo } from "@/components/Logo";
import { getFederalData, getUtilities, getVehicles } from "@/lib/data";

export default function HomePage() {
  const vehicles = getVehicles();
  const utilities = getUtilities();
  const federal = getFederalData();

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Logo className="text-2xl" />
          <nav className="text-sm text-ink-soft">
            <a
              href="#calculator"
              className="hover:text-ink transition"
            >
              Calculator
            </a>
            <span className="mx-2 text-slate-300">·</span>
            <a
              href="https://github.com/pbrennan10-stack/goevwv"
              className="hover:text-ink transition"
            >
              Source
            </a>
          </nav>
        </div>
      </header>

      <section className="mb-10 sm:mb-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
          Is an EV right for you{" "}
          <span className="text-brand">in West Virginia?</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-ink-muted max-w-prose">
          A fair, WV-specific look at the numbers. We factor in your utility,
          our cold winters, the $200 annual EV fee, and federal tax credits —
          so you can decide with open eyes.
        </p>
      </section>

      <div id="calculator">
        <Calculator
          vehicles={vehicles}
          utilities={utilities}
          federal={federal}
        />
      </div>

      <footer className="mt-16 pb-8 border-t border-slate-200 pt-6 text-sm text-ink-soft">
        <p>
          GoEV WV is an independent, non-commercial project. Numbers are
          estimates based on publicly filed utility rates, EPA vehicle data,
          and IRS rules; not financial advice. Data reviewed quarterly — if
          something looks off, open an issue on{" "}
          <a
            className="underline hover:text-ink"
            href="https://github.com/pbrennan10-stack/goevwv"
          >
            GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  );
}

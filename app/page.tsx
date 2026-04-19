import Link from "next/link";
import { FitCheck } from "@/components/FitCheck";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Logo className="text-2xl" />
          <nav className="text-sm text-ink-soft flex items-center">
            <Link
              href="/calculator"
              className="hover:text-ink transition px-2 py-2"
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

      <section className="mb-10 sm:mb-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
          Is an EV right for you{" "}
          <span className="text-brand">in West Virginia?</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-ink-muted max-w-prose">
          Every vehicle has its use cases. EVs shine on the long commutes
          West Virginians rack up — cheap miles, quiet power, a full battery
          every morning. They have real drawbacks too: cold-weather range,
          towing, thin rural DCFC coverage. The public EV conversation is
          loud in both directions — hype from one side, dismissal from the
          other — so this tool does an honest evaluation for how you
          actually drive.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-3 text-sm sm:text-base transition shadow-sm"
          >
            Get your numbers →
          </Link>
          <span className="text-sm text-ink-soft sm:ml-2">
            Or start with a 3-question fit check below.
          </span>
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

      <FitCheck />

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

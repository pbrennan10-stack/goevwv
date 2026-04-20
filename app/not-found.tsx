import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-12 sm:py-20">
      <div className="max-w-2xl">
        <Logo className="text-2xl mb-10" />
        <div className="text-xs font-mono uppercase tracking-wider text-brand-dark mb-3">
          404
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight mb-4">
          That page isn&rsquo;t on the map.
        </h1>
        <p className="text-base sm:text-lg text-ink-muted mb-8 max-w-prose">
          We couldn&rsquo;t find what you were looking for — either the link was
          wrong, the page moved, or we haven&rsquo;t built it yet. Try one of
          these instead:
        </p>
        <ul className="flex flex-col gap-2 text-base">
          <li>
            <Link
              href="/"
              className="text-brand-dark font-medium hover:underline"
            >
              → Home
            </Link>
          </li>
          <li>
            <Link
              href="/calculator"
              className="text-brand-dark font-medium hover:underline"
            >
              → The EV cost calculator
            </Link>
          </li>
          <li>
            <Link
              href="/chargers"
              className="text-brand-dark font-medium hover:underline"
            >
              → WV charger map
            </Link>
          </li>
          <li>
            <Link
              href="/about"
              className="text-brand-dark font-medium hover:underline"
            >
              → Why EVs Matter
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
}

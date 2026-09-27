import Link from "next/link";
import { AiDataNotice } from "./AiDataNotice";

export function SiteFooter() {
  return (
    <footer className="mt-16 pb-8 border-t border-slate-200 pt-6 text-sm text-ink-soft">
      <p>
        GoEV WV is an independent, non-commercial project. Numbers are
        estimates based on publicly filed utility rates, EPA vehicle data,
        and IRS rules; not financial advice. Every source and retrieval date
        is on the{" "}
        <Link href="/state-of-the-data" className="text-brand hover:underline">
          State of the Data
        </Link>{" "}
        page.
      </p>
      <AiDataNotice className="mt-3" />
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/plan" className="hover:text-ink">Plan your household</Link>
        <Link href="/calculator" className="hover:text-ink">Calculator</Link>
        <Link href="/ev" className="hover:text-ink">All EVs</Link>
        <Link href="/utilities" className="hover:text-ink">WV utility EV rates</Link>
        <Link href="/chargers" className="hover:text-ink">Charger map</Link>
        <Link href="/faq" className="hover:text-ink">FAQ</Link>
      </p>
      <p className="mt-3 text-xs">
        &copy; {new Date().getFullYear()} GoEV WV. Built by Patrick Brennan in West Virginia.
      </p>
    </footer>
  );
}

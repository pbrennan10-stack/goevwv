import type { Metadata } from "next";
import Link from "next/link";
import { LEARN_PAGES } from "@/components/LearnLayout";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "EV 101 for West Virginia",
  description: "Plain-English guides for West Virginians new to electric cars: charging at home, winter, road trips, maintenance, myths, used EVs, and hybrids vs EVs.",
  alternates: { canonical: "/learn" },
};

export default function LearnHub() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
        EV 101 <span className="text-brand">for West Virginia</span>
      </h1>
      <p className="mt-3 text-lg text-ink-muted">
        Short, honest guides for anyone new to electric cars — including the downsides. Numbers update
        with our data, and every source is on <Link href="/state-of-the-data" className="text-brand hover:underline">State of the Data</Link>.
      </p>
      <ul className="mt-8 grid sm:grid-cols-2 gap-4">
        {LEARN_PAGES.map((p) => (
          <li key={p.slug}>
            <Link href={`/learn/${p.slug}`} className="block h-full rounded-2xl bg-white ring-1 ring-slate-200 p-5 hover:ring-brand">
              <span className="font-bold text-ink">{p.title}</span>
              <span className="mt-1 block text-sm text-ink-muted">{p.blurb}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/learn/glossary" className="block h-full rounded-2xl bg-white ring-1 ring-slate-200 p-5 hover:ring-brand">
            <span className="font-bold text-ink">EV words in plain English</span>
            <span className="mt-1 block text-sm text-ink-muted">kWh, Level 2, fast charging, and the rest.</span>
          </Link>
        </li>
      </ul>
      <SiteFooter />
    </main>
  );
}

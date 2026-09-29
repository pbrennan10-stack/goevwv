import type { Metadata } from "next";
import Link from "next/link";
import glossary from "@/data/glossary.json";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "EV terms explained in plain English",
  description:
    "What kWh, Level 2, fast charging, plug-in hybrid, winter range, and other EV words mean — in plain English, for West Virginia drivers.",
  alternates: { canonical: "/learn/glossary" },
};

export default function GlossaryPage() {
  const entries = Object.entries(glossary.terms).sort((a, b) => a[1].term.localeCompare(b[1].term));
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
        EV words, <span className="text-brand">in plain English</span>
      </h1>
      <p className="mt-3 text-ink-muted">
        New to electric cars? These are the terms you&apos;ll run into on this site (and at the dealer).
        Tap any dotted-underlined word elsewhere on the site for the same explanation.
      </p>
      <dl className="mt-8 space-y-5">
        {entries.map(([id, e]) => (
          <div key={id} id={id} className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
            <dt className="font-bold text-ink">{e.term}</dt>
            <dd className="mt-1 text-ink-muted">{e.short}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-sm text-ink-muted">
        Ready to try it on your own driving? <Link href="/#fit-check" className="text-brand hover:underline">Take the 4-question fit check</Link> or{" "}
        <Link href="/plan" className="text-brand hover:underline">plan your household</Link>.
      </p>
      <SiteFooter />
    </main>
  );
}

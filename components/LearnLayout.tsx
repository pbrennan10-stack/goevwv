import Link from "next/link";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

// Shared shell for the EV 101 pages (/learn/*): short, plain-language
// explainers whose numbers come from data/*, so they stay current.

export const LEARN_PAGES = [
  { slug: "charging-at-home", title: "Charging at home", blurb: "Regular outlet or Level 2? What it costs, and what if you rent." },
  { slug: "winter", title: "EVs in a West Virginia winter", blurb: "How much range you lose in the cold — and how much gas cars lose too." },
  { slug: "road-trips", title: "Road trips and charging stops", blurb: "How fast charging works, how long stops take, and WV's charger coverage." },
  { slug: "what-wears-out", title: "What wears out", blurb: "Five years of maintenance, side by side: gas vs electric." },
  { slug: "myths", title: "EV myths, checked", blurb: "True, partly true, or not true — with the numbers." },
  { slug: "power-outages", title: "When the power goes out", blurb: "Three ways an EV can keep the lights on — from a fridge on its outlet to backing up the house." },
  { slug: "used-evs", title: "Buying a used EV", blurb: "Battery health, warranties, and what a used one should cost." },
  { slug: "checklists", title: "Scripts and checklists", blurb: "What to ask your employer, your electrician, and the dealer — ready to copy or print." },
  { slug: "hybrid-plug-in-or-electric", title: "Hybrid, plug-in hybrid, or fully electric?", blurb: "Which one fits how you drive." },
  { slug: "ten-thousand-dollar-car", title: "What a $10,000 car would do to your budget", blurb: "The cheapest EV in the world costs about $10,000 in China. What that price would mean for a West Virginia household, and why it isn't sold here." },
] as const;

export function LearnLayout({ slug, title, intro, children }: { slug: string; title: string; intro: React.ReactNode; children: React.ReactNode }) {
  const others = LEARN_PAGES.filter((p) => p.slug !== slug);
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader />
      <nav className="text-sm text-ink-soft mb-4" aria-label="Breadcrumb">
        <Link href="/learn" className="hover:underline">EV 101</Link>
        <span className="mx-1">›</span>
        <span>{title}</span>
      </nav>
      <article className="prose-custom">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">{title}</h1>
        <div className="mt-3 text-lg text-ink-muted">{intro}</div>
        <div className="mt-8 space-y-8 text-ink leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mb-2 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
          {children}
        </div>
      </article>
      <aside className="mt-12 rounded-2xl bg-brand-bg ring-1 ring-emerald-200 p-5">
        <p className="font-semibold text-ink">See what it means for your household</p>
        <p className="mt-1 text-sm text-ink-muted">Four questions for a quick fit check, or plan your whole driveway with purchase price and resale included.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/#fit-check" className="inline-flex rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-4 py-2.5 text-sm">Fit check</Link>
          <Link href="/plan" className="inline-flex rounded-xl border border-slate-300 bg-white hover:border-brand text-ink font-semibold px-4 py-2.5 text-sm">Plan your household</Link>
        </div>
      </aside>
      <nav className="mt-10" aria-label="More EV 101">
        <h2 className="text-lg font-bold text-ink">More EV 101</h2>
        <ul className="mt-3 grid sm:grid-cols-2 gap-3">
          {others.map((p) => (
            <li key={p.slug}>
              <Link href={`/learn/${p.slug}`} className="block rounded-xl bg-white ring-1 ring-slate-200 p-4 hover:ring-brand">
                <span className="font-semibold text-ink">{p.title}</span>
                <span className="block text-sm text-ink-muted">{p.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SiteFooter />
    </main>
  );
}

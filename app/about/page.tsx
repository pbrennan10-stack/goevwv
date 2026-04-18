import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Why EVs Are an Important Decision",
  description:
    "Patrick Brennan on why EV adoption matters beyond fuel savings — manufacturing sovereignty, energy flexibility, and why legislation alone can't get us there.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="text-sm text-ink-soft flex items-center">
            <Link href="/" className="hover:text-ink transition px-2 py-2">
              Calculator
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/about" className="text-brand font-semibold transition px-2 py-2">
              Why EVs Matter
            </Link>
          </nav>
        </div>
      </header>

      <article className="max-w-prose">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight mb-2">
          Why EVs Are an{" "}
          <span className="text-brand">Important Decision</span>
        </h1>
        <p className="text-ink-soft text-sm mb-10">By Patrick Brennan</p>

        <div className="space-y-12 text-ink-muted leading-relaxed">

          <p className="text-lg sm:text-xl text-ink leading-snug border-l-4 border-brand pl-5 py-1">
            Most EV conversations start and end with the environment. That&rsquo;s
            not where I start. Whether you drive an EV matters for reasons that
            go well beyond your carbon footprint — and those reasons deserve a
            plain-language explanation.
          </p>

          <Section num="01" title="Manufacturing sovereignty and national security">
            <p>
              The battery is to the 21st century what steel was to the 20th.
              Whoever controls battery manufacturing controls electric vehicles,
              autonomous drones, grid storage, and the supply chains that
              underpin modern military capability. China understood this early.
              They built the factories, secured the raw material supply chains,
              and now produce the majority of the world&rsquo;s lithium-ion cells.
            </p>
            <PullQuote>
              The battery is to the 21st century what steel was to the 20th.
            </PullQuote>
            <p>
              The United States is competing to rebuild that capability
              domestically. That competition isn&rsquo;t theoretical — it shows
              up in drone warfare, in grid resilience after extreme weather,
              and in the industrial capacity to scale production during a
              crisis. The factories being built in Georgia, Kentucky, and
              Michigan depend on a domestic market large enough to justify the
              investment. Consumer EV adoption is what creates that market.
              Without it, the investment thesis for domestic battery
              manufacturing weakens, and the supply chain dependency on China
              deepens.
            </p>
            <p className="mt-4">
              Buying an American-assembled EV is a small act with a real
              connection to a large strategic question.
            </p>
          </Section>

          <Section num="02" title="Energy flexibility">
            <p>
              A gasoline car runs on one fuel source. An electric vehicle can
              run on coal, natural gas, nuclear, hydro, solar, or wind —
              whatever the grid is generating, and whatever your rooftop
              produces. That flexibility is strategically valuable in a way
              that doesn&rsquo;t show up in a monthly fuel bill comparison.
            </p>
            <p className="mt-4">
              In 2021, Texas&rsquo;s gas supply froze and millions lost heat
              and power. In 2022, fuel prices spiked globally because of a war
              in Eastern Europe. A transportation system that can draw from
              multiple energy sources is more resilient to those shocks than
              one that depends on a single refined commodity with a global spot
              price. Energy independence, at the national level, requires
              flexibility at the vehicle level.
            </p>
          </Section>

          <Section num="03" title="Cost and the China question">
            <p>
              Chinese automakers can produce a capable electric vehicle for
              under $10,000. American manufacturers cannot — yet. The gap is
              real and it has several causes, but one of them is scale.
              High-volume production drives down per-unit battery costs, which
              are still the most expensive component in an EV. China has that
              scale. The US is building toward it.
            </p>
            <p className="mt-4">
              Domestic demand is what makes the investment in US scale
              defensible. Every gigafactory that opens, every battery cell
              produced in America rather than imported, moves the cost curve in
              the right direction. The path to an affordable American EV runs
              through the purchase decisions Americans make today. This is not
              a comfortable thing to say, but it is honest.
            </p>
          </Section>

          <Section num="04" title="Why legislation can't solve this alone">
            <p>
              The 2010 Citizens United decision made it legal for corporations
              to spend unlimited sums influencing elections. The fossil fuel
              industry spends more on lobbying and political advertising than
              almost any other sector in the American economy. The predictable
              result: legislators who understand the strategic case for
              domestic EV adoption face significant political costs for acting
              on that understanding.
            </p>
            <p className="mt-4">
              This isn&rsquo;t a partisan point. It&rsquo;s a structural
              description of how policy gets made — and how it gets blocked.
              Sensible, long-term energy policy is genuinely difficult to pass
              when the companies most exposed by that policy can direct large
              sums toward defeating the politicians who support it. That
              dynamic exists regardless of which party is in power.
            </p>
            <PullQuote>
              When enough Americans choose EVs, the industry exists. When it
              exists, the manufacturing base exists. When the manufacturing
              base exists, the strategic capability exists. The chain is that
              direct.
            </PullQuote>
            <p>
              The implication is that individual decisions carry more weight
              than they would if the policy environment were functional.
              Markets are the one signal that even a captured legislature
              can&rsquo;t fully suppress.
            </p>
          </Section>

          <Section num="05" title="What this site is">
            <p>
              I built GoEV WV because West Virginians deserve honest numbers
              instead of either fossil fuel dismissal or environmental advocacy
              dressed up as analysis. This calculator uses publicly filed
              utility rates, EPA vehicle data, and current federal tax credit
              rules — no manufacturer partnerships, no affiliate revenue, no
              agenda beyond giving you a defensible estimate.
            </p>
            <p className="mt-4">
              Make the decision that makes sense for your situation. This site
              exists to help you make it with open eyes.
            </p>
          </Section>

        </div>
      </article>

      <footer className="mt-16 pb-8 border-t border-slate-200 pt-6 text-sm text-ink-soft">
        <p>
          GoEV WV is an independent, non-commercial project.{" "}
          <Link href="/" className="underline hover:text-ink">
            Back to the calculator →
          </Link>
        </p>
      </footer>
    </main>
  );
}

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-brand font-mono text-sm font-semibold tracking-wider">
          {num}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-ink leading-tight">
          {title}
        </h2>
      </div>
      <div className="space-y-0">{children}</div>
    </section>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="my-6 border-l-4 border-brand pl-5 py-2 text-lg sm:text-xl font-semibold text-ink leading-snug">
      {children}
    </blockquote>
  );
}

import type { Metadata } from "next";
import { AiDataNotice } from "@/components/AiDataNotice";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Why EVs Matter",
  description:
    "Patrick Brennan on why EV adoption matters beyond fuel savings — energy independence, manufacturing sovereignty, cost and simplicity, and why what people buy matters more than what Washington does.",
};

// Each figure the essay states, and where it comes from.
const SOURCES = [
  { claim: "Colonial Pipeline shutdown, May 2021, and Virginia's state of emergency:", label: "WHSV, May 11, 2021", url: "https://www.whsv.com/2021/05/11/va-governor-declares-state-of-emergency-amid-colonial-pipeline-shutdown" },
  { claim: "China's share of lithium-ion cell production, about 80%:", label: "TechInsights, 2025", url: "https://www.techinsights.com/ko/node/61132" },
  { claim: "About 20 moving parts in an electric drivetrain versus roughly 200 in a conventional one:", label: "Interplex", url: "https://interplex.com/?p=21228" },
  { claim: "BYD Seagull from 69,900 yuan in China:", label: "Electrek, May 2026", url: "https://electrek.co/2026/05/11/byd-upgrades-cheapest-ev-with-lidar-still-starts-at-13k/" },
  { claim: "Oil and gas lobbying, about $137 million and fifth among industries in 2023 (OpenSecrets data):", label: "Planet Detroit", url: "https://planetdetroit.org/?p=15870" },
  { claim: "The federal EV credit's end for vehicles bought after September 30, 2025 (P.L. 119-21):", label: "State of the Data", url: "/state-of-the-data" },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader active="/about" />

      <article className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight mb-2">
          Why EVs <span className="text-brand">Matter</span>
        </h1>
        <p className="text-ink-soft text-sm mb-10">By Patrick Brennan</p>

        <div className="space-y-12 text-ink-muted leading-relaxed">

          <p className="text-lg sm:text-xl text-ink leading-snug border-l-4 border-brand pl-5 py-1">
            Most EV conversations start and end with the environment. That&rsquo;s
            not where I start. Whether you drive an EV matters for reasons that
            go well beyond your carbon footprint — and those reasons deserve a
            plain-language explanation.
          </p>

          <Section num="01" title="Energy flexibility and independence">
            <p>
              A gasoline car runs on one fuel source. An electric vehicle can
              run on coal, natural gas, nuclear, hydro, solar, or wind —
              whatever the grid is generating, and whatever your rooftop
              produces. That flexibility is strategically valuable in a way
              that doesn&rsquo;t show up in a monthly fuel bill comparison,
              and it is the practical foundation of energy independence.
            </p>
            <p className="mt-4">
              Gasoline is a single refined commodity with a global spot
              price. When something disrupts that supply — a war in Eastern
              Europe, a storm on the Gulf Coast, a pipeline outage, an OPEC
              decision made in a room Americans aren&rsquo;t in — the price
              at every pump in West Virginia moves within days. In May 2021
              a ransomware attack shut the Colonial Pipeline for most of a
              week; stations across Virginia and the Southeast ran dry within
              days and Virginia declared a state of emergency. In 2022, pump
              prices spiked when Russia invaded Ukraine. A transportation system that can
              draw from multiple domestic energy sources — much of it
              generated right here in the Appalachian basin — is more
              resilient to those shocks than one tethered to a single
              internationally-priced fuel.
            </p>
            <p className="mt-4">
              Energy independence at the national level requires flexibility
              at the vehicle level. The more household transportation runs on
              domestically-generated electricity, the less leverage any
              foreign oil producer, refining cartel, or spot-market
              speculator has over the American driver.
            </p>
          </Section>

          <Section num="02" title="Manufacturing sovereignty and national security">
            <p>
              The battery is to the 21st century what steel was to the 20th.
              Whoever controls battery manufacturing controls electric vehicles,
              autonomous drones, grid storage, and the supply chains that
              underpin modern military capability. China understood this early.
              They built the factories, secured the raw material supply chains,
              and now make about 80% of the world&rsquo;s lithium-ion cells.
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
              connection to a large strategic question. Every{" "}
              <Link href="/ev" className="text-brand hover:underline">vehicle page</Link> here
              says where that model is built, so it&rsquo;s a thing you can check.
            </p>
          </Section>

          <Section num="03" title="Cost, simplicity, and the China question">
            <p>
              An electric drivetrain is mechanically much simpler than a gasoline
              one. A conventional drivetrain has roughly 200 moving parts across
              the engine, transmission, exhaust and fuel system. An electric
              drivetrain has about 20. No spark plugs, no timing belts, no
              oxygen sensors, no multi-speed transmission, no oil pump, no engine
              radiator (the battery and motor keep a smaller cooling loop), no
              catalytic converter, no exhaust system, no fuel injectors, no
              alternator. Regenerative braking removes most wear from the brake
              pads too.
            </p>
            <p className="mt-4">
              That simplicity compounds across the lifecycle. Engineering is
              cheaper because there&rsquo;s less to design. Assembly is cheaper
              because there are fewer parts to install and align. Ongoing
              maintenance is cheaper — no oil changes, no timing services, no
              transmission flushes, brake pads that wear far more slowly. Those
              are line items on the bill of materials and the shop invoice. At
              enough volume, that simpler bill of materials should let an EV
              undercut a gas car on price; the battery is the part that still
              has to get cheaper for that to happen here.
            </p>
            <p className="mt-4">
              Which is why China&rsquo;s position matters. BYD sells its
              Seagull in China from 69,900 yuan, about $10,300, before any
              tariff. American manufacturers can&rsquo;t build to that price —
              yet. The gap is real and it has
              several causes, but the primary one is scale: high-volume
              production drives down per-unit battery costs, which are still
              the most expensive component in an EV. China has that scale.
              The US is building toward it.
            </p>
            <p className="mt-4">
              Domestic demand is what makes the investment in US scale
              defensible. Every gigafactory that opens, every battery cell
              produced in America rather than imported, moves the cost curve
              in the right direction. The path to an affordable American EV
              runs through the purchase decisions Americans make today.
            </p>
          </Section>

          <Section num="04" title="Why this doesn't wait on Washington">
            <p>
              Policy is the least reliable part of this picture. Congress
              created a $7,500 EV credit in 2008, rebuilt it in 2022, and ended
              it for vehicles bought after September 30, 2025. State rules move
              too. Whichever party is in power, every industry with a stake
              lobbies hard — oil and gas was the fifth-largest lobbying industry
              in 2023 at about $137 million, with electric utilities and
              automakers also among the big spenders — so the rules will keep
              changing, and a buyer who waits for them to settle will wait a
              long time.
            </p>
            <p className="mt-4">
              The signal that doesn&rsquo;t swing is what people buy. Factories
              get built where the customers are, and a factory, once built,
              outlasts any one Congress.
            </p>
            <PullQuote>
              When enough Americans choose EVs, the industry exists. When it
              exists, the manufacturing base exists. When the manufacturing
              base exists, the strategic capability exists. The chain is that
              direct.
            </PullQuote>
            <p>
              That puts more weight on individual decisions than most people
              assume. A market is the one signal no legislature can switch off,
              and it&rsquo;s the one lever a West Virginia household actually
              holds.
            </p>
          </Section>

          <Section num="05" title="What this site is">
            <p>
              I built GoEV WV because West Virginians deserve honest numbers
              instead of a sales pitch from either side. I think more EVs would
              be good for West Virginia, for the reasons above, and you should
              know that going in. The calculator doesn&rsquo;t care what I
              think: it runs on publicly filed utility rates, EPA vehicle data,
              and the current federal and state rules, including the end of the
              federal credit in 2025 — no manufacturer partnerships, no
              affiliate revenue. Every number&rsquo;s source is on{" "}
              <Link href="/state-of-the-data" className="text-brand hover:underline">State of the Data</Link>.
            </p>
            <p className="mt-4">
              Make the decision that makes sense for your situation. This site
              exists to help you make it with open eyes.
            </p>
          </Section>

          <section className="text-sm">
            <h2 className="text-base font-bold text-ink mb-2">Sources for the figures above</h2>
            <ul className="list-disc pl-5 space-y-1">
              {SOURCES.map((s) => (
                <li key={s.url}>
                  {s.claim}{" "}
                  <a href={s.url} className="text-brand hover:underline" rel="noopener">{s.label}</a>
                </li>
              ))}
            </ul>
          </section>

        </div>
      </article>

      <footer className="mt-16 pb-8 border-t border-slate-200 pt-6 text-sm text-ink-soft">
        <p>
          GoEV WV is an independent, non-commercial project.{" "}
          <Link href="/calculator" className="underline hover:text-ink">
            Back to the calculator →
          </Link>
        </p>
        <AiDataNotice className="mt-3" />
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

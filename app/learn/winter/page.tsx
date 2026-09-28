import type { Metadata } from "next";
import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { Term } from "@/components/Term";
import { ANNUAL_WINTER_KWH_MULTIPLIER, HYBRID_WINTER_FUEL_MULTIPLIER, ICE_WINTER_FUEL_MULTIPLIER } from "@/lib/calc";
import { getVehicles } from "@/lib/data";

export const metadata: Metadata = {
  title: "EVs in a West Virginia winter: how much range you really lose",
  description: "How cold weather affects electric car range in WV, how gas cars and hybrids lose efficiency too, and simple ways to keep more range in January.",
  alternates: { canonical: "/learn/winter" },
};

export default function Page() {
  const winters = getVehicles()
    .filter((v) => v.powertrain === "bev" && v.status === "current" && v.class !== "van" && v.winter_range_mi)
    .map((v) => v.winter_range_mi!)
    .sort((a, b) => a - b);
  const median = winters[Math.floor(winters.length / 2)];
  const pct = (m: number) => Math.round((m - 1) * 100);
  return (
    <LearnLayout slug="winter" title="EVs in a West Virginia winter"
      intro={<>Cold weather costs every car efficiency. EVs lose more range than gas cars do — enough to plan around, rarely enough to matter for a daily commute.</>}>
      <section>
        <h2>How much range you lose</h2>
        <p>
          On a freezing morning, expect roughly a quarter less range than the <Term id="range">EPA number</Term> — mostly
          from heating the cabin and a cold battery. We use a 28% cut for our <Term id="winter-range">WV winter range</Term>.
          The median EV sold today still goes about <strong>{median} miles</strong> on a cold day.
        </p>
        <p>Averaged over a whole year (about four cold months), that works out to ~{pct(ANNUAL_WINTER_KWH_MULTIPLIER)}% more electricity.</p>
      </section>
      <section>
        <h2>Gas cars lose efficiency too</h2>
        <p>
          The U.S. Department of Energy finds gas cars about 15% less efficient at 20°F on short trips, and hybrids
          30–34% less. Over a year that&apos;s roughly {pct(ICE_WINTER_FUEL_MULTIPLIER)}% more gas for a regular car and{" "}
          {pct(HYBRID_WINTER_FUEL_MULTIPLIER)}% for a hybrid. Our numbers count winter on both sides.
        </p>
      </section>
      <section>
        <h2>Keeping more range in January</h2>
        <ul>
          <li><strong>Warm it up while it&apos;s plugged in.</strong> Most EVs can heat the cabin and battery from the app before you leave, using house power instead of range.</li>
          <li><strong>Use the heated seats and wheel.</strong> They use far less energy than heating the whole cabin.</li>
          <li><strong>Park in a garage</strong> if you can — a warmer battery charges faster and goes farther.</li>
          <li><strong>A heat pump</strong> (standard on many newer EVs) cuts cold-weather losses noticeably.</li>
          <li><strong>Fast charging is slower when the battery is cold.</strong> Navigating to a charger lets many EVs pre-warm the battery on the way.</li>
        </ul>
      </section>
      <section>
        <h2>What it means for you</h2>
        <p>
          If your round trip is well under a car&apos;s winter range, winter is an inconvenience, not a problem. The{" "}
          <Link href="/ev" className="text-brand hover:underline">EV list</Link> shows every model&apos;s cold-day range, and
          the <Link href="/plan" className="text-brand hover:underline">planner</Link> flags any day that gets close.
        </p>
      </section>
    </LearnLayout>
  );
}

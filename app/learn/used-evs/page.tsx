import type { Metadata } from "next";
import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { Term } from "@/components/Term";
import { getOwnershipAssumptions, getWearData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Buying a used EV in West Virginia: battery health, warranty, and price",
  description: "What to check before buying a used electric car: battery health reports, the 8-year battery warranty, charging speed, and how to tell if the price makes sense.",
  alternates: { canonical: "/learn/used-evs" },
};

export default function Page() {
  const own = getOwnershipAssumptions();
  const wear = getWearData();
  const fade = wear.battery.fade_per_year_pct;
  const usedDep = Math.round(own.used_vehicle_annual_depreciation * 100);
  const r = own.retention_scenarios_5yr;
  return (
    <LearnLayout slug="used-evs" title="Buying a used EV"
      intro={<>Used EVs can be the best deal in the whole car market — or a headache, if the battery or charging setup doesn&apos;t fit you. Here&apos;s what to check.</>}>
      <section>
        <h2>Why used EVs can be a bargain</h2>
        <p>
          EVs bought new have lost value faster than gas cars — we assume one keeps about {Math.round(r.bev.mid * 100)}% of
          its list price after 5 years, against {Math.round(r.gas.mid * 100)}% for a typical gas car. Some of that came from
          the old $7,500 tax credit and big new-car price cuts, which pulled used prices down. That loss is the first
          owner&apos;s, not yours. Used-EV prices firmed in 2026 as gas prices rose, but they&apos;re still often low for
          what you get.
        </p>
      </section>
      <section>
        <h2>The battery: what to check</h2>
        <ul>
          <li>
            <strong>Ask for a battery health report.</strong> Many dealers can print one, and services like Recurrent
            estimate it from the car&apos;s data. A healthy <Term id="battery">battery</Term> loses about {fade}% of its
            range a year, so a 5-year-old car at around {100 - fade * 5}% is normal.
          </li>
          <li>
            <strong>Check the battery warranty.</strong> It runs {wear.battery.warranty}, and it usually transfers
            to the next owner. Find the car&apos;s original sale date — the clock started then.
          </li>
          <li>
            <strong>Look up recalls</strong> by VIN at nhtsa.gov. Some models had battery recalls that ended with a free
            new battery, which is a plus.
          </li>
        </ul>
      </section>
      <section>
        <h2>Other things that matter more than on a gas car</h2>
        <ul>
          <li><strong>Winter range.</strong> Take about a quarter off the range for a cold day, then check it against your longest regular drive.</li>
          <li><strong>Heat pump.</strong> Older and cheaper EVs often lack one and lose more range in the cold.</li>
          <li><strong>Fast-charging speed and plug.</strong> Older EVs can charge slowly on road trips. Some use plugs that are becoming rare (CHAdeMO on older Nissan Leafs).</li>
          <li><strong>Home charging.</strong> A used EV makes the most sense if you can plug in at home — see <Link href="/learn/charging-at-home" className="text-brand hover:underline">charging at home</Link>.</li>
        </ul>
      </section>
      <section>
        <h2>What should a used one cost?</h2>
        <p>
          We don&apos;t track used prices — they vary too much car to car. Instead, the{" "}
          <Link href="/plan" className="text-brand hover:underline">household planner</Link> works backward: after it compares
          your options, it shows the most a used EV could cost and still come out ahead of a new EV or new gas car, for
          your driving. It assumes a used car loses about {usedDep}% of its value a year and costs the same to run as a new
          one.
        </p>
      </section>
    </LearnLayout>
  );
}

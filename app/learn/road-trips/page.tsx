import type { Metadata } from "next";
import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { Term } from "@/components/Term";
import { dcfcStopMiles } from "@/lib/calc";
import { getChargingInfra, getFederalData, getVehicles } from "@/lib/data";

export const metadata: Metadata = {
  title: "EV road trips from West Virginia: charging stops, times, and coverage",
  description: "How fast charging works on a road trip, how many stops a beach trip takes, how long they last, and where WV's charger coverage is good or thin.",
  alternates: { canonical: "/learn/road-trips" },
};

export default function Page() {
  const infra = getChargingInfra();
  const dcfc = getFederalData().calculation_notes.dcfc_rate_per_kwh;
  const ss = infra.statewide_summary;
  const all = getVehicles();
  const examples = ["tesla-model-y-2025", "chevy-equinox-ev-2025", "hyundai-ioniq-5-lr-2025", "ford-f150-lightning-2025"]
    .map((id) => all.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => !!v && !!v.highway_range_mi);
  return (
    <LearnLayout slug="road-trips" title="Road trips and charging stops"
      intro={<>EV road trips work better than most people expect — and they take more planning than gas. Here&apos;s what a trip actually looks like.</>}>
      <section>
        <h2>How a fast-charging stop works</h2>
        <p>
          You leave home full. When you get low, you stop at a <Term id="fast-charger">fast charger</Term> and top up to
          about 80% — past that, charging slows way down. Most stops take 20–40 minutes, about the length of a meal or
          restroom break. Walk-up prices run about {Math.round((dcfc?.current ?? 0.55) * 100)}¢ per kWh
          {dcfc?.member_rate ? ` (Tesla drivers pay closer to ${Math.round(dcfc.member_rate * 100)}¢)` : ""}.
        </p>
      </section>
      <section>
        <h2>Example: a 400-mile beach trip</h2>
        <ul>
          {examples.map((v) => {
            const stops = dcfcStopMiles(v.highway_range_mi!, 400).length;
            return (
              <li key={v.id}>
                <strong>{v.make} {v.model}</strong>: about {v.highway_range_mi} miles at 70 mph →{" "}
                {stops === 0 ? "no stops" : `${stops} stop${stops > 1 ? "s" : ""}`} each way.
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-ink-muted">Assumes you can charge overnight where you&apos;re staying. Towing cuts EV range roughly in half.</p>
      </section>
      <section>
        <h2>West Virginia&apos;s charger coverage</h2>
        <p>About {ss.dcfc_ports_approx} fast-charging ports at {ss.dcfc_sites_approx} locations statewide ({ss.as_of}), plus ~{ss.l2_ports_approx} slower public ports.</p>
        <ul>
          {infra.corridors.map((c) => <li key={c.id}><strong>{c.name}</strong>: {c.coverage} coverage.</li>)}
        </ul>
        <p>
          Federally funded fast chargers along WV interstates aren&apos;t open yet — the first are expected{" "}
          {infra.nevi_status.estimated_stations_open.replace(/\s*\(.*\)/, "")}. Rural two-lane routes remain thin.
        </p>
        <p>
          See every charger on the <Link href="/chargers" className="text-brand hover:underline">charger map</Link>, and
          check each trip in the <Link href="/plan" className="text-brand hover:underline">planner</Link>.
        </p>
      </section>
    </LearnLayout>
  );
}

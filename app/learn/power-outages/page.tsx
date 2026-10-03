import type { Metadata } from "next";
import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { backupDays, backupOptions, fmtDays, makerDays, type BackupPathEntry } from "@/lib/backup";
import { getBackupPower, getVehicles } from "@/lib/data";
import type { Vehicle } from "@/lib/types";

type WithBattery = Vehicle & { battery_kwh: number };

export const metadata: Metadata = {
  title: "Can an EV power your house when the grid goes down? Outages in West Virginia",
  description:
    "Three ways an electric vehicle keeps the lights on in a West Virginia outage: a household outlet on the vehicle, a 240-volt outlet with a transfer switch, or whole-home backup hardware — what each costs and how many days a battery lasts.",
  alternates: { canonical: "/learn/power-outages" },
};

const name = (v: Vehicle) => `${v.make} ${v.model}`;
const dedupe = (xs: string[]) => Array.from(new Set(xs));

export default function Page() {
  const data = getBackupPower();
  const evs = getVehicles();
  const byId = new Map(evs.map((v) => [v.id, v]));
  const shopping = evs.filter((v) => v.class !== "van");
  const options = shopping.map((v) => ({ v, o: backupOptions(v.id, v.features, data) }));
  const checked = options.filter(({ v, o }) => v.features || o.transferSwitch).length;
  const withOutlet = dedupe(options.filter(({ o }) => o.outlet === true).map(({ v }) => name(v)));
  const namesFor = (e: BackupPathEntry) => dedupe(e.ids.map((id) => byId.get(id)).filter((v): v is Vehicle => !!v).map(name)).join(", ");
  // One row per vehicle with a 240-volt outlet or V2H hardware, biggest battery first.
  const runtimeRows = dedupe([...data.transfer_switch, ...data.v2h].flatMap((e) => e.ids))
    .map((id) => byId.get(id))
    .filter((v): v is WithBattery => !!v && v.battery_kwh != null)
    .sort((a, b) => b.battery_kwh - a.battery_kwh);
  const biggest = runtimeRows[0];
  const typical = data.typical_home_kwh_per_day, essentials = data.essentials_kwh_per_day;

  return (
    <LearnLayout slug="power-outages" title="When the power goes out"
      intro={<>A charged EV in the driveway is the biggest battery most households will ever own. Getting that power into the house ranges from plugging in a cord to a serious electrical project — here&apos;s the honest ladder, cheapest rung first.</>}>
      <section>
        <h2>How much energy is that?</h2>
        <p>
          A typical home uses about {typical} kWh of electricity a day. Running only the essentials — fridge and freezer,
          the furnace blower, a well or sump pump, lights and phones — takes roughly {essentials} kWh. We count {Math.round(data.usable_share * 100)}% of a
          battery as usable for backup; the rest stays in reserve so the vehicle can still reach a charger afterward, and covers inverter losses.
        </p>
        {biggest && (
          <p>
            The largest pack in our catalog, the {name(biggest)}&apos;s {biggest.battery_kwh} kWh, works out to{" "}
            {fmtDays(backupDays(biggest.battery_kwh, typical, data))} of typical use or {fmtDays(backupDays(biggest.battery_kwh, essentials, data))} of essentials.
            A mid-size EV battery is a night or two of essentials — still more than most portable generators carry in fuel.
          </p>
        )}
      </section>

      <section>
        <h2>Rung 1: a household outlet on the vehicle — nothing to install</h2>
        <p>
          Some EVs have ordinary 120-volt outlets in the bed, the cabin or the cargo area, and a few sell an adapter that
          turns the charge port into one. Run a heavy-duty outdoor extension cord to the fridge, a lamp, the internet
          router and a space heater, and you have what a small portable generator gives you — without the noise, the
          fumes or the gas can.
        </p>
        <p>
          Of the {checked} vehicles whose equipment we&apos;ve checked, {withOutlet.length} have one: {withOutlet.join(", ")}. It won&apos;t
          run anything wired into the house — a well pump, central heat, the water heater — because those don&apos;t plug
          into an outlet. That&apos;s what the next two rungs are for.
        </p>
      </section>

      <section>
        <h2>Rung 2: a 240-volt outlet plus a transfer switch</h2>
        <p>
          A few trucks carry a 240-volt outlet, the same kind a portable generator has. Wire a transfer switch or interlock
          into your panel — the standard generator hookup a licensed electrician installs — and the truck runs the circuits
          you choose: furnace, well pump, fridge, lights. The whole house stays off the grid while you&apos;re on truck power,
          so nothing can feed back into the lines and endanger a line crew.
        </p>
        <ul>
          {data.transfer_switch.map((e) => (
            <li key={e.ids.join()}>
              <strong>{namesFor(e)}:</strong> {e.outlet}{e.kw_240v ? `, ${e.kw_240v} kW` : ""}{e.kw_total ? ` (${e.kw_total} kW across all outlets)` : ""}.
              {e.requires ? ` ${e.requires}` : ""} {e.hookup} Cost: {e.cost}.
              {e.confidence === "approximate" ? " (Approximate — see State of the Data.)" : ""}
            </li>
          ))}
        </ul>
        <p>
          <strong>Never</strong> improvise this with a cord into a dryer outlet. A backfeed like that can electrocute a
          utility worker and burn down the house, and it&apos;s illegal. Use Ford&apos;s connector only with the GenerLink it was
          made for. A meter-mounted switch also needs your utility&apos;s permission:
        </p>
        <ul>
          {(data.utility_notes ?? []).map((u) => (
            <li key={u.utility}><strong>{u.utility}:</strong> {u.note}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Rung 3: whole-home backup hardware</h2>
        <p>
          Vehicle-to-home (V2H) systems send power out through the charge port into a bidirectional charger and a gateway
          that islands the house from the grid. The switchover is automatic and the whole panel is live, within the
          hardware&apos;s limit. It&apos;s the most capable option and by far the most expensive.
        </p>
        <ul>
          {data.v2h.map((e) => (
            <li key={e.ids.join()}>
              <strong>{namesFor(e)}:</strong> {e.system}{e.kw ? `, up to ${e.kw} kW` : ""}. {e.cost}.{e.availability ? ` ${e.availability}.` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>How many days?</h2>
        <p>
          Battery size times the usable share, divided by daily use. Where the maker publishes its own figure, it&apos;s noted
          on the row — they use the same {typical} kWh-a-day assumption.
        </p>
        <ul className="!list-none !pl-0 divide-y divide-slate-100" aria-label="Days of backup by vehicle">
          {runtimeRows.map((v) => {
            const m = makerDays(v.id, data);
            return (
              <li key={v.id} className="!mt-0 py-2.5" data-days-row>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-ink">{name(v)} <span className="font-normal text-ink-soft">{v.trim}</span></span>
                  <span className="text-sm text-ink-muted whitespace-nowrap">{v.battery_kwh} kWh</span>
                </div>
                <div className="text-sm text-ink">
                  {fmtDays(backupDays(v.battery_kwh, typical, data))} of typical use · {fmtDays(backupDays(v.battery_kwh, essentials, data))} of essentials
                  {m != null ? <span className="text-ink-muted"> · {v.make} says up to {m} days</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-ink-muted">
          When the outage outlasts the battery, drive to a fast charger and come back — something a generator can&apos;t do
          when the gas stations are dark too.
        </p>
      </section>

      <section>
        <h2>Owner&apos;s note</h2>
        <p>
          I drive an F-150 Lightning, and I&apos;m setting it up to back up my house through the 240-volt outlet in the bed
          and a transfer switch — the middle rung above, not the whole-home system. The truck was bought for driving; the
          backup came with it.
        </p>
      </section>

      <section>
        <h2>The honest caveat</h2>
        <p>
          Nobody should buy an EV for outage power alone — a portable generator does that job for a fraction of the price.
          The point is that if an EV fits how you drive, a very large battery comes with it, and for a growing list of
          models, using it to keep the house warm and the food cold is now a documented, supported option rather than a
          hack. Check the vehicle&apos;s page under &ldquo;When the power goes out,&rdquo; or the{" "}
          <Link href="/plan" className="text-brand hover:underline">household planner</Link>&apos;s used shopping list, which marks the models that can do it.
        </p>
      </section>
    </LearnLayout>
  );
}

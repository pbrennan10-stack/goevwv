import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton, PrintPageButton } from "@/components/CopyText";
import { LearnLayout } from "@/components/LearnLayout";
import { getChecklists, getFederalData, getOwnershipAssumptions, getUtilities, getWearData } from "@/lib/data";
import { $0 } from "@/lib/typical";

export const metadata: Metadata = {
  title: "EV scripts and checklists: ask your employer, your electrician, and the dealer",
  description:
    "Ready-to-use pieces for West Virginia EV shoppers: an email asking about charging at work, a checklist for the electrician's visit, and a used-EV walk-around for the dealer lot — copy or print.",
  alternates: { canonical: "/learn/checklists" },
};

const WORK_EMAIL = `Subject: Charging an electric car at work

Hi [name],

I'm looking at an electric vehicle, and whether I can plug in at work is part of the decision. Three quick questions:

1. Is there an outlet or a charger employees can use, or could one be added? Even a regular outdoor outlet helps; a 240-volt outlet or a Level 2 charger covers a full day's commute.
2. If so, would it be free, or billed? I'm glad to pay for what I use.
3. Who's the right person to talk to about it — facilities, HR, or you?

Businesses pay less per kilowatt-hour than homes do, so the cost to the company is small, and I'd be plugged in during the day when the car is sitting anyway.

Thanks,
[name]`;

export default function Page() {
  const data = getChecklists().electrical;
  const own = getOwnershipAssumptions();
  const fed = getFederalData();
  const wear = getWearData();
  const rebates = getUtilities().flatMap((u) => u.rebates.filter((r) => r.type === "l2_charger").map((r) => ({ u, r })));
  const chargerAmps = Math.round(data.dryer_circuit_amps * data.continuous_load_share);
  const bevFee = fed.wv_state_fees.bev_annual_fee.amount_usd;
  const phevFee = fed.wv_state_fees.phev_annual_fee.amount_usd;
  const taxPct = Math.round(own.wv_purchase_tax.rate * 100);

  return (
    <LearnLayout slug="checklists" title="Scripts and checklists"
      intro={<>The numbers on this site end in a decision; these three pieces handle what comes right after. Copy the email, print the lists, hand the dealer one.</>}>
      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintPageButton />
      </div>

      <section>
        <h2>1. Ask your employer about charging at work</h2>
        <p>
          Free charging at work is the single biggest change to the money side of an EV, and plenty of employers would say
          yes if someone asked. This email asks the three things that matter. Change the bracketed parts and send it.
        </p>
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-sm leading-relaxed text-ink font-sans">{WORK_EMAIL}</pre>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <CopyButton text={WORK_EMAIL} label="Copy the email" />
          <span className="text-sm text-ink-muted">Then set &ldquo;Can you charge at work?&rdquo; in the <Link href="/plan" className="text-brand hover:underline">planner</Link> to see what it does to your numbers.</span>
        </div>
      </section>

      <section>
        <h2>2. Before the electrician comes</h2>
        <p>
          A Level 2 charger install runs about {$0(own.home_charging_setup.level2_installed_usd)} in a typical house. The expensive
          surprise is a panel upgrade, and most of it can be avoided or priced before anyone shows up. Have these ready:
        </p>
        <ul>
          <li><strong>A photo of your panel with the door open,</strong> and the number on the main breaker at the top (100, 150 or 200 amps).</li>
          <li><strong>What else runs on electricity:</strong> range, water heater, heat or heat pump, central air, dryer, hot tub, well pump.</li>
          <li><strong>Where the car parks</strong> and how far that is from the panel, in rough feet. Distance drives the wire cost.</li>
          <li><strong>Any 240-volt outlet you already have</strong> near the car — dryer, welder, RV hookup — and the size of its breaker.</li>
          <li><strong>Your utility and account number,</strong> for rebate paperwork and, if needed, your recorded peak demand.</li>
        </ul>
        <p>Then ask for:</p>
        <ul>
          <li>
            <strong>The cheapest path first.</strong> A charger on an existing dryer circuit is set to {Math.round(data.continuous_load_share * 100)}% of the breaker
            rating — {chargerAmps} amps on a {data.dryer_circuit_amps}-amp circuit — and a listed smart splitter lets the dryer and the
            car share the outlet. No new wiring.
          </li>
          <li>
            <strong>A load calculation before a panel upgrade.</strong> {data.load_management_note}
          </li>
          <li><strong>A permit and inspection.</strong> West Virginia follows the {data.nec_edition} National Electrical Code (statewide since {data.nec_effective}); the permit is how the install gets checked against it.</li>
          {rebates.length > 0 && (
            <li>
              <strong>The charger your utility&apos;s rebate requires.</strong>{" "}
              {rebates.map(({ u, r }) => `${u.name}: ${r.amount_usd ? $0(r.amount_usd) : "a rebate"}${r.name ? ` (${r.name})` : ""}`).join("; ")}.
              Ask whether the model you&apos;re quoted qualifies before it&apos;s ordered.
            </li>
          )}
          <li><strong>An itemized quote:</strong> charger, wire and conduit, breaker, labor, permit. It makes a second quote easy to compare.</li>
        </ul>
        <p className="text-sm text-ink-muted">
          Never run a cord from a dryer outlet to the car without a device made for it, and never backfeed a panel. Both are
          fire and shock hazards. <Link href="/learn/charging-at-home" className="text-brand hover:underline">More on charging at home</Link>.
        </p>
      </section>

      <section>
        <h2>3. On the used-car lot</h2>
        <p>
          A used EV skips the steepest part of the value drop, and the things that go wrong with one are different from a
          gas car&apos;s. Walk the lot with this list; the{" "}
          <Link href="/plan" className="text-brand hover:underline">planner</Link> takes the price you find and tells you whether it&apos;s a good one.
        </p>
        <ul>
          <li><strong>Battery health report.</strong> Ask for one; third-party services generate them from the VIN if the dealer doesn&apos;t have it. The battery warranty is typically {wear.battery.warranty}, and it transfers with the car — confirm the in-service date.</li>
          <li><strong>Displayed range at a full charge vs the EPA figure</strong> on the window sticker or the model&apos;s page here. Some loss is normal; a big gap is a negotiating point or a walk-away.</li>
          <li><strong>Charge port and adapters.</strong> Which plug it uses, and whether the adapter for the other kind is in the car. Older plugs limit which fast chargers you can use.</li>
          <li><strong>Heat pump.</strong> Cars without one lose more range in a West Virginia January. The model&apos;s equipment table here says whether the trim had one.</li>
          <li><strong>Everything that should be in the car:</strong> the charging cord, both key cards or fobs, and the previous owner removed from the maker&apos;s app, so you can set up your own.</li>
          <li><strong>Recalls and software.</strong> Run the VIN through the federal recall lookup; ask whether updates are current.</li>
          <li><strong>Tires and the 12-volt battery.</strong> EVs are heavy on tires; a dead 12-volt battery strands an EV just like a gas car.</li>
          <li><strong>A fast-charging stop on the test drive.</strong> Ten minutes at a public fast charger shows whether it charges at the speed the model should.</li>
          <li><strong>The West Virginia extras:</strong> {taxPct}% sales tax after your trade-in, title, and the state&apos;s annual EV fee — {$0(bevFee)} for a fully electric vehicle, {$0(phevFee)} for a plug-in hybrid.</li>
        </ul>
        <p className="text-sm text-ink-muted">
          <Link href="/learn/used-evs" className="text-brand hover:underline">More on buying used</Link>, including what a used one should cost for your household.
        </p>
      </section>
    </LearnLayout>
  );
}

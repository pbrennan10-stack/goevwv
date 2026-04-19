import type { ChargingInfraData } from "@/lib/types";

const COVERAGE_BADGE: Record<string, { label: string; color: string }> = {
  good: { label: "Good", color: "bg-green-100 text-green-800" },
  moderate: { label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
  thin: { label: "Thin — gaps exist", color: "bg-red-100 text-red-800" },
};

const GAP_COLOR: Record<string, string> = {
  moderate: "text-amber-700",
  high: "text-red-700",
};

export function ChargingStatus({ data }: { data: ChargingInfraData }) {
  const { nevi_status, statewide_summary, corridors, live_data_links } = data;
  const alloc_m = (nevi_status.allocation_usd / 1_000_000).toFixed(1);

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
      <details>
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-ink inline">
              WV Charging Infrastructure — Impartial Status
            </h2>
            <span className="text-xs text-ink-soft ml-2">as of {statewide_summary.as_of}</span>
          </div>
          <span className="text-xs text-ink-soft shrink-0">▼ expand</span>
        </summary>

        {/* Statewide callout */}
        <div className="mt-4 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">State of the network</p>
          <p>
            ~{statewide_summary.dcfc_approx} DC fast chargers and ~
            {statewide_summary.public_ports_approx} total public ports statewide.{" "}
            {statewide_summary.bev_registrations.toLocaleString()} registered EVs (
            {statewide_summary.bev_pct_of_vehicles}% of vehicles). The NEVI program that was
            supposed to materially expand this network{" "}
            <strong>has not issued an RFP as of April 2026</strong> — earliest new stations:{" "}
            <strong>{nevi_status.estimated_stations_open}</strong>.
          </p>
        </div>

        {/* Corridors */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Interstate corridors</h3>
          <div className="space-y-3">
            {corridors.map((c) => {
              const badge = COVERAGE_BADGE[c.coverage] ?? {
                label: c.coverage,
                color: "bg-slate-100 text-slate-700",
              };
              return (
                <div key={c.id} className="rounded-xl ring-1 ring-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                    <div>
                      <span className="font-semibold text-ink text-sm">{c.name}</span>
                      <span className="text-xs text-ink-soft ml-2">
                        {c.length_wv_mi} mi WV segment
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mb-2">{c.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.stations.map((s, i) => (
                      <span
                        key={i}
                        className={[
                          "text-xs px-2 py-0.5 rounded-full",
                          s.kw > 0
                            ? "bg-brand-bg text-brand-dark"
                            : "bg-slate-100 text-slate-500 italic",
                        ].join(" ")}
                      >
                        {s.city}
                        {s.kw > 0 ? ` (${s.kw}kW)` : " (planned)"}
                      </span>
                    ))}
                  </div>
                  {c.gaps.map((g, i) => (
                    <p
                      key={i}
                      className={`text-xs flex items-start gap-1 ${GAP_COLOR[g.severity] ?? "text-amber-700"}`}
                    >
                      <span aria-hidden="true">{g.severity === "high" ? "⚠" : "→"}</span>
                      <span>
                        {g.description}
                        {g.note ? ` — ${g.note}` : ""}
                      </span>
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* NEVI status */}
        <div className="mt-5 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-sm">
          <div className="font-semibold text-ink mb-2">NEVI Federal Funding Status</div>
          <p className="text-xs text-ink-muted mb-3">{nevi_status.note}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
            <span>
              Allocated: <strong className="text-ink">${alloc_m}M</strong>
            </span>
            <span>
              Stations planned: <strong className="text-ink">{nevi_status.stations_planned}</strong>
            </span>
            <span>
              RFP expected:{" "}
              <strong className="text-ink">{nevi_status.rfp_expected ?? "TBD"}</strong>
            </span>
            <span>
              Earliest open:{" "}
              <strong className="text-ink">{nevi_status.estimated_stations_open}</strong>
            </span>
          </div>
        </div>

        {/* Live data links */}
        <div className="mt-4 text-xs text-ink-soft">
          <span className="font-medium text-ink">Check current charger status:</span>{" "}
          <a
            href={live_data_links.plugshare}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            PlugShare
          </a>
          {" · "}
          <a
            href={live_data_links.chargepoint}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            ChargePoint
          </a>
          {" · "}
          <a
            href={live_data_links.tesla_supercharger}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            Tesla Supercharger
          </a>
          <p className="mt-1 italic">{live_data_links.note}</p>
        </div>
      </details>
    </section>
  );
}

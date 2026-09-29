import { ASSIST_LABEL, OTA_LABEL, visibleRows, type Features, type FeatureKey } from "@/lib/features";

// Standard-equipment facts for one trim, or two side by side. No hooks, so it
// renders on the server (/ev/[id]) and inside the planner.

function Mark({ v }: { v: boolean | null | undefined }) {
  if (v === true) return <span className="text-emerald-700 font-semibold">✓ Standard</span>;
  if (v === false) return <span className="text-ink-soft">Not standard</span>;
  return <span className="text-ink-soft italic">Not confirmed</span>;
}

function Confidence({ f }: { f: Features }) {
  // `source` is a URL for some vehicles and a description ("kiamedia.com
  // features-by-trim page") for others; only a URL gets a link.
  const first = f.source?.split(/\s*;\s*/)[0];
  const url = first && /^https?:\/\//.test(first) ? first : null;
  return (
    <p className="mt-3 text-xs text-ink-soft">
      {f.confidence === "verified" ? "Checked against the maker's spec sheet" : "Checked against dealer and review trim guides"}
      {url ? (
        <>
          {" "}(<a href={url} className="text-brand hover:underline" rel="noopener">source</a>)
        </>
      ) : f.source ? (
        <> (source: {f.source})</>
      ) : null}
      . Gathered with AI help and may contain errors — confirm with the dealer. &ldquo;Not standard&rdquo; usually means
      it&apos;s available at extra cost or on a higher trim.
    </p>
  );
}

export function EquipmentList({ f, isEv, trim }: { f: Features; isEv: boolean; trim?: string }) {
  const groups = visibleRows(f, isEv);
  return (
    <div>
      {trim && <p className="text-sm text-ink-muted">What comes standard on the {trim} trim.</p>}
      <div className="mt-3 rounded-xl bg-brand-bg ring-1 ring-brand/20 p-3 text-sm">
        <div className="font-semibold text-ink">Driver assist</div>
        <div className="text-ink">{ASSIST_LABEL[f.driver_assist_level]}</div>
        {f.driver_assist_name && <div className="text-xs text-ink-soft">{f.driver_assist_name}</div>}
      </div>
      <div className="mt-3 grid sm:grid-cols-3 gap-x-6">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mt-3 text-sm font-semibold text-ink">{g.title}</h3>
            <dl>
              {g.rows.map((r) => (
                <div key={r.key} className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
                  <dt className="text-ink-muted">{r.label}</dt>
                  <dd className="text-right shrink-0"><Mark v={f[r.key]} /></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-muted">
        {f.main_screen_in ? `${f.main_screen_in}-inch main screen. ` : ""}
        Over-the-air software updates: {OTA_LABEL[f.ota_updates ?? "unknown"].toLowerCase()}.
      </p>
      <Confidence f={f} />
    </div>
  );
}

type Side = { name: string; f?: Features; isEv: boolean };

export function EquipmentCompare({ a, b }: { a: Side; b: Side }) {
  const base = a.f ?? b.f;
  if (!base) return null;
  // Show a row if it applies to either side.
  const groups = visibleRows(base, a.isEv || b.isEv).map((g) => ({
    ...g,
    rows: g.rows.filter((r) => !(r.key === "power_liftgate" && a.f?.power_liftgate == null && b.f?.power_liftgate == null)),
  }));
  const cell = (s: Side, key: FeatureKey, evOnly?: boolean) =>
    !s.f ? <span className="text-ink-soft italic">—</span> : evOnly && !s.isEv ? <span className="text-ink-soft">n/a</span> : <Mark v={s.f[key]} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-soft border-b border-slate-200">
            <th className="py-2 pr-3 font-medium">Standard on the trim we priced</th>
            <th className="py-2 pl-2 font-medium">{a.name}</th>
            <th className="py-2 pl-2 font-medium">{b.name}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 align-top">
            <td className="py-2 pr-3">Driver assist</td>
            <td className="py-2 pl-2">{a.f ? ASSIST_LABEL[a.f.driver_assist_level] : "—"}</td>
            <td className="py-2 pl-2">{b.f ? ASSIST_LABEL[b.f.driver_assist_level] : "—"}</td>
          </tr>
          {groups.flatMap((g) =>
            g.rows.map((r) => (
              <tr key={r.key} className="border-b border-slate-100">
                <td className="py-2 pr-3">{r.label}</td>
                <td className="py-2 pl-2">{cell(a, r.key, r.evOnly)}</td>
                <td className="py-2 pl-2">{cell(b, r.key, r.evOnly)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-soft">
        Gathered with AI help from maker and dealer trim guides; may contain errors — confirm with the dealer. &ldquo;Not
        standard&rdquo; usually means it costs extra or comes on a higher trim.
        {!a.f || !b.f ? " — means we haven't finished checking that model." : ""}
      </p>
    </div>
  );
}

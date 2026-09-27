// Tiny zero-dependency chart kit (plain HTML + SVG, works in server and
// client components). Rules: bars start at zero and share a scale within a
// chart; values are labeled in ink-colored text (never text in a fill
// color); every chart has an aria-label sentence; bar widths animate only
// when the user hasn't asked for reduced motion; colors print.

export const CHART_COLORS = {
  ev: "#059669",      // brand bright (fills only)
  gas: "#334155",     // slate-700
  phev: "#0369a1",    // sky-700
  neutral: "#64748b", // slate-500
  fee: "#b45309",     // amber-700
  light: "#cbd5e1",   // slate-300
} as const;

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ---------- Horizontal bars (one value per row) ----------

export interface BarRow {
  label: string;
  value: number;
  color?: string;
  valueLabel?: string;   // defaults to $value
  note?: string;         // small text under the label
}

export function HBars({ rows, ariaLabel, max }: { rows: BarRow[]; ariaLabel: string; max?: number }) {
  const scale = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div role="img" aria-label={ariaLabel} className="chart space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink font-medium">{r.label}</span>
            <span className="text-ink font-bold tabular-nums">{r.valueLabel ?? fmt$(r.value)}</span>
          </div>
          <div className="mt-1 h-4 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500"
              style={{ width: `${Math.max(1, (r.value / scale) * 100)}%`, background: r.color ?? CHART_COLORS.neutral }}
            />
          </div>
          {r.note && <div className="mt-0.5 text-xs text-ink-soft">{r.note}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------- Stacked bars (several segments per row, shared scale) ----------

export interface Segment { key: string; label: string; value: number; color: string }
export interface StackRow { label: string; sublabel?: string; segments: Segment[]; highlight?: boolean }

export function StackedBars({ rows, ariaLabel, legend = true }: { rows: StackRow[]; ariaLabel: string; legend?: boolean }) {
  const totals = rows.map((r) => r.segments.reduce((s, x) => s + Math.max(0, x.value), 0));
  const scale = Math.max(1, ...totals);
  const legendItems = rows[0]?.segments ?? [];
  return (
    <div className="chart">
      <div role="img" aria-label={ariaLabel} className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-sm ${r.highlight ? "font-bold text-ink" : "font-medium text-ink"}`}>
                {r.label}
                {r.sublabel && <span className="block text-xs font-normal text-ink-soft">{r.sublabel}</span>}
              </span>
              <span className="text-lg font-extrabold text-ink tabular-nums">{fmt$(totals[i])}</span>
            </div>
            <div className="mt-1 flex h-5 w-full gap-[2px]" style={{ width: `${(totals[i] / scale) * 100}%` }}>
              {r.segments.filter((s) => s.value > 0).map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${fmt$(s.value)}`}
                  className="h-full first:rounded-l-md last:rounded-r-md motion-safe:transition-[flex-grow] motion-safe:duration-500"
                  style={{ flexGrow: s.value, flexBasis: 0, background: s.color }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {legend && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-hidden>
          {legendItems.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Diverging range strip ("EV costs more" ← $0 → "EV saves") ----------

export function SavingsRange({
  low, mid, high, ariaLabel, leftLabel = "EV costs more", rightLabel = "EV saves",
}: {
  low: number; mid: number; high: number;   // positive = EV saves
  ariaLabel: string; leftLabel?: string; rightLabel?: string;
}) {
  const span = Math.max(1000, Math.abs(low), Math.abs(mid), Math.abs(high)) * 1.15;
  const x = (v: number) => 50 + (v / span) * 50; // percent
  const lo = Math.min(low, high), hi = Math.max(low, high);
  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <div className="relative h-12">
        <div className="absolute inset-x-0 top-5 h-2 rounded-full bg-slate-100" />
        <div className="absolute top-5 h-2 rounded-full" style={{ left: `${x(lo)}%`, width: `${x(hi) - x(lo)}%`, background: "rgba(5,150,105,0.35)" }} />
        <div className="absolute top-2 bottom-2 w-px bg-slate-400" style={{ left: "50%" }} />
        <div
          className="absolute top-3.5 h-5 w-5 -ml-2.5 rounded-full border-2 border-white shadow motion-safe:transition-[left] motion-safe:duration-500"
          style={{ left: `${x(mid)}%`, background: mid >= 0 ? CHART_COLORS.ev : CHART_COLORS.fee }}
        />
      </div>
      <div className="flex justify-between text-xs text-ink-soft">
        <span>← {leftLabel}</span>
        <span>$0</span>
        <span>{rightLabel} →</span>
      </div>
    </div>
  );
}

// The frame and tiles the link-preview images share (the planner's share
// card, the vehicle guide cards). Rendered by next/og (satori) in route
// handlers, so: every element with several children is display:flex, colors
// are literal, and there's no CSS class.

import type { ReactNode } from "react";

export const CARD_SIZE = { width: 1200, height: 630 };
// A card only changes when the data files do (a deploy).
export const CARD_HEADERS = { "Cache-Control": "public, max-age=86400, s-maxage=86400" };

export const GREEN = "#059669", INK = "#0f172a", MUTED = "#475569", SOFT = "#64748b";
export const SAVES = "#065f46", COSTS = "#92400e";

export function Frame({ kicker, path, footer, children }: { kicker: string; path: string; footer: string; children: ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff", padding: "56px 72px 48px", fontFamily: "sans-serif", color: INK, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, backgroundColor: GREEN }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 44, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
          <span>Go</span>
          <span style={{ color: GREEN }}>EV</span>
          <span>&nbsp;WV</span>
        </div>
        <div style={{ fontSize: 24, color: MUTED }}>{kicker}</div>
      </div>
      {children}
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24 }}>
        <div style={{ fontSize: path.length > 20 ? 22 : 26, color: GREEN, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{path}</div>
        <div style={{ fontSize: footer.length > 50 ? 18 : 20, color: SOFT, textAlign: "right", maxWidth: 560 }}>{footer}</div>
      </div>
    </div>
  );
}

export function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f8fafc", borderRadius: 16, padding: "18px 22px" }}>
      <div style={{ fontSize: 21, color: SOFT }}>{label}</div>
      <div style={{ fontSize: value.length > 18 ? 27 : 38, fontWeight: 800, lineHeight: 1.15, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: sub.length > 28 ? 16 : sub.length > 26 ? 18 : 20, color: SOFT, marginTop: 6, lineHeight: 1.25 }}>{sub}</div>
    </div>
  );
}

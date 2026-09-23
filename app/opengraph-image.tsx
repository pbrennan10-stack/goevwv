import { ImageResponse } from "next/og";

// Use edge runtime — the Node runtime path inside @vercel/og calls
// fileURLToPath on an invalid URL during Windows builds. Edge runtime
// doesn't take that code path and works on both local (Windows) and
// production (Linux) builds.
export const runtime = "edge";
export const alt = "GoEV WV — Is an EV right for you in West Virginia?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          padding: "80px 90px",
          fontFamily: "sans-serif",
          color: "#0f172a",
          position: "relative",
        }}
      >
        {/* brand-color top border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "14px",
            backgroundColor: "#059669",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 80,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          <span>Go</span>
          <span style={{ color: "#059669" }}>EV</span>
          <span>&nbsp;WV</span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: 64,
            fontWeight: 800,
            marginTop: 40,
            lineHeight: 1.1,
            maxWidth: "1000px",
            letterSpacing: "-0.02em",
          }}
        >
          <span>Is an EV right for you</span>
          <span style={{ color: "#059669" }}>in West Virginia?</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#475569",
            marginTop: 36,
            maxWidth: "1000px",
            lineHeight: 1.35,
          }}
        >
          Impartial, WV-specific numbers. Your utility, our winters, realistic
          highway range, and what daily life actually looks like.
        </div>

        {/* Footer row */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div style={{ fontSize: 24, color: "#059669", fontWeight: 700 }}>
            goevwv.com
          </div>
          <div style={{ fontSize: 20, color: "#64748b" }}>
            Honest EV math for West Virginia
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

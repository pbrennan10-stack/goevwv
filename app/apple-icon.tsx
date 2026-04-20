import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#059669",
          color: "#ffffff",
          fontSize: 92,
          fontWeight: 900,
          fontFamily: "sans-serif",
          letterSpacing: "-0.05em",
          // iOS automatically applies a rounded-rect mask, so no explicit border-radius needed.
        }}
      >
        EV
      </div>
    ),
    { ...size },
  );
}

// Twitter/X link card uses the same image as Open Graph.
// Re-export the opengraph-image module wholesale so the image only renders once
// in code but Next.js generates both /opengraph-image and /twitter-image routes.
//
// Note: `runtime` is declared separately here (not re-exported) because Next.js
// needs it as a direct export on each route segment — module re-export semantics
// don't propagate it. Without this, the twitter-image route falls back to the
// Node runtime and fails on the Windows fileURLToPath path inside @vercel/og.
export const runtime = "edge";
export { alt, size, contentType, default } from "./opengraph-image";

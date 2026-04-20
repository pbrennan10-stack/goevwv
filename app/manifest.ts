import type { MetadataRoute } from "next";

// Web App Manifest — makes the site installable on mobile home screens and
// desktop (Chrome "Install app" option). Icons are served via /icon and
// /apple-icon routes from the icon.tsx / apple-icon.tsx ImageResponse files.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoEV WV",
    short_name: "GoEV WV",
    description:
      "Impartial, WV-specific EV guidance — utility rates, realistic highway range, daily-life math.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["utilities", "business", "lifestyle"],
    lang: "en-US",
  };
}

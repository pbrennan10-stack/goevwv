import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://goevwv.com"),
  title: {
    default: "GoEV WV — Is an EV right for you in West Virginia?",
    template: "%s | GoEV WV",
  },
  description:
    "Impartial, West Virginia-specific guidance on electric vehicles. Compare EVs by your commute, your utility, and your wallet — tailored to AEP, Mon Power, Wheeling Power, and WV's EV fees.",
  applicationName: "GoEV WV",
  keywords: [
    "West Virginia EV",
    "WV electric vehicle",
    "Appalachian Power EV",
    "Mon Power EV",
    "EV cost calculator WV",
  ],
  authors: [{ name: "GoEV WV" }],
  robots: { index: true, follow: true },
  openGraph: {
    title: "GoEV WV — Is an EV right for you in West Virginia?",
    description:
      "Impartial, WV-specific EV guidance. Your utility, our winters, realistic highway range, and what daily life actually looks like.",
    url: "https://goevwv.com",
    siteName: "GoEV WV",
    type: "website",
    locale: "en_US",
    // og:image is auto-populated from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "GoEV WV — Is an EV right for you in West Virginia?",
    description:
      "Impartial, WV-specific EV guidance. Your utility, our winters, realistic highway range, daily-life math.",
    // twitter:image is auto-populated from app/twitter-image.tsx
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

// Structured data — WebSite schema helps Google understand what the site is
// and can unlock sitelinks/search-box rich results. Kept as a single JSON-LD
// block in the root layout so every page inherits it.
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "GoEV WV",
  alternateName: "Go EV WV",
  url: "https://goevwv.com",
  description:
    "Impartial, West Virginia-specific guidance on electric vehicles. Compare EVs by your commute, your utility, and your wallet.",
  inLanguage: "en-US",
  publisher: {
    "@type": "Organization",
    name: "GoEV WV",
    url: "https://goevwv.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to Mapbox so geocoding + map tiles feel snappy on /chargers and commute entry */}
        <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
        {/* JSON-LD WebSite schema for search engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-screen bg-surface-raised text-ink">
        {/* Skip-to-content link for keyboard users; visually hidden until focused */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-white focus:font-medium focus:shadow-lg"
        >
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}

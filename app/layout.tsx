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
    title: "GoEV WV",
    description:
      "Impartial, WV-specific EV guidance: commute, utility, and rebate calculator.",
    url: "https://goevwv.com",
    siteName: "GoEV WV",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-raised text-ink">{children}</body>
    </html>
  );
}

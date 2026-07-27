import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Monospace carries every number in this app, so it is loaded rather than left
// to a system fallback — column alignment depends on tabular figures.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BEP AI Infrastructure Tracker",
    template: "%s · BEP AI Infrastructure Tracker",
  },
  description: "Global AI compute, power and supply-chain intelligence.",
  // Open project: indexable. The tracker is public and being found is the point.
  robots: { index: true, follow: true },
  metadataBase: new URL("https://tracker.bepresearch.com"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "BEP AI Infrastructure Tracker",
    description:
      "Open data on global AI compute, power and supply chain. Confirmed vs estimated capacity, siting risk in megawatts, and a source for every claim.",
    url: "https://tracker.bepresearch.com",
    siteName: "BEP AI Infrastructure Tracker",
    type: "website",
    // Declaring summary_large_image without an image is worse than declaring
    // nothing: X, Slack and LinkedIn all render the wide card and leave it
    // blank. Static rather than generated — an OG image is served to crawlers
    // on the hot path of every share, and og.png cannot fail at runtime.
    // Regenerate with scripts/make-og-image.py.
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "BEP AI Infrastructure Tracker — announced capacity is not operating capacity.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BEP AI Infrastructure Tracker",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { getConfig } from "@/lib/config";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  const title = `${cfg.APP_BRAND_NAME} ${cfg.APP_PRODUCT_NAME}`;
  return {
    title,
    description: `Private support analytics for ${cfg.APP_BRAND_NAME} — not for public listing.`,
    applicationName: `${cfg.APP_BRAND_NAME} ${cfg.APP_PRODUCT_NAME}`,
    // Hard block search engines / AI crawlers from indexing this private dashboard
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-snippet": 0,
        "max-image-preview": "none",
        "max-video-preview": 0,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/favicon.ico"],
    },
    openGraph: {
      title,
      description: "Private Delicut support analytics (login required).",
      type: "website",
      // Discourage previews / sharing cards
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      card: "summary",
      title,
      description: "Private Delicut support analytics (login required).",
    },
    other: {
      // Extra crawler hints beyond standard robots meta
      googlebot: "noindex, nofollow, noarchive, nosnippet, noimageindex",
      bingbot: "noindex, nofollow, noarchive, nosnippet",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} min-h-screen font-sans antialiased`}
        style={{
          fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}

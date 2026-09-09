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
  return {
    title: `${cfg.APP_BRAND_NAME} ${cfg.APP_PRODUCT_NAME}`,
    description: `Conversation, CSAT, and agent analytics for ${cfg.APP_BRAND_NAME} support`,
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

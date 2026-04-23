import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BRAND } from "@/lib/brand";

/**
 * Resolve the canonical origin for OG / Twitter card URLs.
 *
 * Priority:
 *   1. Explicit override (set once you own a real domain).
 *   2. Vercel's stable production URL (auto-injected on every deploy).
 *   3. Vercel's per-deployment URL (for preview deploys).
 *   4. localhost for `next dev`.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: [
    "real estate",
    "co-ownership",
    "fractional ownership",
    "Ethereum",
    "Sepolia",
    "DAO",
    "DeFi",
    "tokenized real estate",
    "sweat equity",
  ],
  authors: [{ name: BRAND.name }],
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    url: "/",
    siteName: BRAND.name,
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: BRAND.name }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    images: ["/og.svg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a1024",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster
            richColors
            position="bottom-right"
            toastOptions={{
              className: "!bg-surface !text-fg !border !border-border",
            }}
          />
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";
import { OfflineBanner } from "@/components/OfflineBanner";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Read a neutral briefing, form your own view, then see how others responded and why.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#141412" }, { color: "#f7f6f3" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}

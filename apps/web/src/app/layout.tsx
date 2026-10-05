import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Denkraum",
  description: "Lernen mit Papier, Kamera und Rückmeldung.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f5d8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh flex flex-col">
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">{children}</main>
        <footer className="w-full max-w-2xl mx-auto px-4 py-6 text-sm text-muted flex gap-6 border-t border-line">
          <Link href="/datenschutz" className="underline underline-offset-4 min-h-11 inline-flex items-center">
            Datenschutz
          </Link>
          <Link href="/impressum" className="underline underline-offset-4 min-h-11 inline-flex items-center">
            Impressum
          </Link>
        </footer>
      </body>
    </html>
  );
}

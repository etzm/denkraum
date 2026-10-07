import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Denkraum",
  description: "Auf Papier denken, am Bildschirm Rückmeldung bekommen. Ohne Noten, ohne Namen.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2348a8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh flex flex-col">
        <main className="flex-1 w-full px-4 py-8">{children}</main>
        <footer className="w-full max-w-5xl mx-auto px-4 py-6 text-sm text-muted flex flex-wrap gap-x-6 gap-y-2 border-t border-line">
          <Link href="/" className="min-h-11 inline-flex items-center font-semibold text-ink">
            Denkraum
          </Link>
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

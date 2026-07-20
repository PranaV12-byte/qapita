import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import DraftStrip from "@/components/DraftStrip";
import AppShell from "@/components/AppShell";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

const inter = Inter({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Q4N$P — Equity Comp Knowledge Portal",
  description: "AI-powered equity compensation reference for stock plan professionals.",
  robots: "noindex",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${inter.variable}`}>
      <head>
        <meta name="robots" content="noindex" />
      </head>
      <body className="bg-bg text-body font-sans min-h-screen flex flex-col">
        <DraftStrip />
        <AppShell>
          <main className="flex-1 pb-20">
            {children}
          </main>
        </AppShell>
        <footer className="fixed bottom-16 left-0 right-0 px-4 py-2 text-center text-xs text-muted bg-bg border-t border-[var(--border)] z-10">
          This is an AI-generated draft that has not been reviewed by a professional. It is educational only and is not tax, legal, or investment advice. US only.
        </footer>
      </body>
    </html>
  );
}

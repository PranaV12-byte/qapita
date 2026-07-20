import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { LensProvider } from "@/components/lens/LensProvider";

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
        <LensProvider>
          <AppShell>
            <main className="flex-1 w-full">
              {children}
            </main>
          </AppShell>
        </LensProvider>
        <footer className="px-4 py-4 text-center text-xs text-muted border-t border-[var(--border)]">
          This is an AI-generated draft that has not been reviewed by a professional. It is educational only and is not tax, legal, or investment advice. US only.
        </footer>
      </body>
    </html>
  );
}

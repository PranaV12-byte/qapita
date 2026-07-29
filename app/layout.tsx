import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { LensProvider } from "@/components/lens/LensProvider";

const montserrat = Montserrat({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-head",
});

const inter = Inter({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Q4N$P - EquityIQ",
  description:
    "US equity compensation knowledge and drafting workspace for stock plan professionals.",
  robots: "noindex",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <head>
        <meta name="robots" content="noindex" />
      </head>
      <body className="bg-bg text-body font-sans">
        <LensProvider>
          <AppShell>
            <main className="w-full">{children}</main>
          </AppShell>
        </LensProvider>
        <footer className="border-t border-white/10 bg-[var(--shell)] px-4 py-3 text-white/90 lg:pl-[304px]">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#28d05d]" />
              Endorsed by NASPP, National Association of Stock Plan Professionals
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-white/90 px-2 py-1">
                <img
                  src="/brand/naspp.png"
                  alt="NASPP"
                  className="h-5 w-auto"
                />
              </span>
              <span className="h-5 w-px bg-white/20" />
              <img
                src="/brand/qapita.png"
                alt="Qapita"
                className="h-5 w-auto"
              />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

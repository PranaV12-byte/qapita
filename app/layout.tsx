import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { BrandCluster } from "@/components/brand/Logos";
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
      <body className="bg-bg pb-[60px] text-body font-sans">
        <LensProvider>
          <AppShell>
            <main className="w-full">{children}</main>
          </AppShell>
        </LensProvider>
        <footer className="fixed inset-x-0 bottom-0 z-40 h-[60px] border-t border-white/10 bg-[var(--shell)] px-4 text-white/90">
          <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#28d05d]" />
              Endorsed by NASPP, National Association of Stock Plan Professionals
            </div>
            <BrandCluster
              className="inline-flex items-center"
              qapitaClassName="h-6 w-auto"
              nasppClassName="h-5 w-auto object-contain"
              separatorClassName="mx-4 h-6 w-px bg-white/50"
            />
          </div>
        </footer>
      </body>
    </html>
  );
}

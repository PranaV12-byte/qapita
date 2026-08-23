import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { LensProvider } from "@/components/lens/LensProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter-local",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EquityIQ",
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
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <head>
        <meta name="robots" content="noindex" />
      </head>
      <body className="bg-bg text-body font-sans">
        <AuthProvider>
          <LensProvider>
            <AppShell>
              <div className="w-full">{children}</div>
            </AppShell>
          </LensProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

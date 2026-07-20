"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Home", href: "/" },
  { label: "Browse", href: "/browse" },
  { label: "Generate", href: "/generate" },
  { label: "Glossary", href: "/glossary" },
];

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-surface-1 border-b border-[var(--border)] px-4 flex items-center h-12">
        <Link href="/" className="font-serif text-heading text-xl tracking-tight hover:opacity-80 transition-opacity" style={{ textDecoration: "none" }}>
          Q4N$P
        </Link>
      </header>

      {/* Content */}
      {children}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-[var(--border)] flex">
        {tabs.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center text-xs font-medium transition-colors"
              style={{
                minHeight: "44px",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

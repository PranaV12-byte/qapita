"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Browse", href: "/browse" },
  { label: "Glossary", href: "/glossary" },
];

// Extra destinations surfaced only in the mobile drawer.
const drawerExtra = [
  { label: "Ask a question", href: "/generate" },
  { label: "Start here", href: "/start-here" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-surface-1 border-b border-[var(--border)]">
        <div className="mx-auto w-full max-w-5xl px-4 md:px-6 h-12 flex items-center">
          <Link
            href="/"
            className="font-serif text-heading text-xl tracking-tight hover:opacity-80 transition-opacity"
            style={{ textDecoration: "none" }}
          >
            Q4N$P
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 ml-auto">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm transition-colors hover:text-[var(--text-primary)]"
                style={{
                  color: isActive(pathname, l.href)
                    ? "var(--accent)"
                    : "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="md:hidden ml-auto inline-flex items-center justify-center text-[var(--text-primary)]"
            style={{ minWidth: "44px", minHeight: "44px" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      {children}

      {/* Mobile nav drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 bottom-0 w-3/4 max-w-xs bg-surface-1 border-r border-[var(--border)] p-4 flex flex-col">
            <div className="flex items-center mb-4">
              <span className="font-serif text-heading text-lg">Q4N$P</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="ml-auto inline-flex items-center justify-center text-[var(--text-muted)]"
                style={{ minWidth: "44px", minHeight: "44px" }}
              >
                ✕
              </button>
            </div>
            {[...navLinks, ...drawerExtra].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center rounded-lg px-3 transition-colors"
                style={{
                  minHeight: "44px",
                  color: isActive(pathname, l.href)
                    ? "var(--accent)"
                    : "var(--text-body)",
                  backgroundColor: isActive(pathname, l.href)
                    ? "var(--surface-2)"
                    : "transparent",
                  textDecoration: "none",
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SearchOverlay from "@/components/search/SearchOverlay";
import { BrandLockup } from "@/components/brand/Logos";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Browse", href: "/browse" },
  { label: "Glossary", href: "/glossary" },
  { label: "My Brain", href: "/brain" },
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
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl-K opens search anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Top bar */}
      <header className="shrink-0 z-40 bg-surface-1 border-b border-[var(--border)]">
        <div className="w-full px-4 md:px-6 h-14 flex items-center">
          <BrandLockup />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 ml-auto">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] hover:border-[var(--accent)] transition-colors"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search
              <kbd className="text-[10px] border border-[var(--border)] rounded px-1 text-[var(--text-muted)]">
                ⌘K
              </kbd>
            </button>
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

          {/* Mobile actions */}
          <div className="md:hidden ml-auto flex items-center">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center justify-center text-[var(--text-primary)]"
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
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center text-[var(--text-primary)]"
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
              <BrandLockup compact />
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

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

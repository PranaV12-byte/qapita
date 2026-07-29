"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SearchOverlay from "@/components/search/SearchOverlay";
import { BrandLockup } from "@/components/brand/Logos";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Knowledge tree", href: "/browse" },
  { label: "Draft generator", href: "/generate" },
  { label: "Brain", href: "/brain" },
];

const navIcons = {
  "/": (
    <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
  ),
  "/browse": (
    <>
      <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </>
  ),
  "/generate": <path d="m13 2-2 7h5l-5 13 2-9H8l5-11Z" />,
  "/brain": (
    <>
      <path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v2a3 3 0 0 0 3 3h1" />
      <path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v2a3 3 0 0 1-3 3h-1" />
      <path d="M9 9h6" />
      <path d="M12 6v12" />
    </>
  ),
};

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
      <header className="fixed inset-x-0 top-0 z-40 h-[72px] border-b border-white/10 bg-[var(--shell)] shadow-[0_10px_30px_rgba(61,31,116,0.22)]">
        <div className="flex h-full items-center gap-4 px-4 md:px-6">
          <BrandLockup />
          <div className="ml-auto hidden lg:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              className="flex min-h-[46px] w-[360px] max-w-[40vw] items-center gap-3 rounded-xl border border-white/15 bg-white/12 px-4 text-left text-sm text-white/70 transition hover:bg-white/14"
            >
              <svg
                width="18"
                height="18"
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
              <span className="truncate">Search topics, articles, artifacts...</span>
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 text-white/90"
            >
              <svg
                width="20"
                height="20"
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
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 text-white/90"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-screen pb-[60px] pt-[72px]">
        <aside
          className="fixed left-0 top-[72px] z-30 hidden border-r border-[var(--border)] bg-[var(--shell-soft)]/80 backdrop-blur lg:block"
          style={{
            bottom: 60,
            width: collapsed ? 88 : 276,
            transition: "width 220ms ease",
          }}
        >
          <div className="flex h-full flex-col px-3 py-5">
            <div className="mb-3 flex items-center justify-between px-2">
              {!collapsed && (
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Navigation
                </span>
              )}
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{
                    transform: collapsed ? "rotate(180deg)" : "none",
                    transition: "transform 160ms ease",
                  }}
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            </div>
            <nav aria-label="Primary navigation" className="space-y-1">
              {navLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex min-h-[52px] items-center gap-3 rounded-2xl px-4 text-sm font-medium transition"
                    style={{
                      textDecoration: "none",
                      color: active ? "var(--accent)" : "var(--text-body)",
                      backgroundColor: active ? "rgba(99, 62, 165, 0.12)" : "transparent",
                      boxShadow: active ? "inset 3px 0 0 0 var(--accent)" : "none",
                    }}
                  >
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: active
                          ? "rgba(99, 62, 165, 0.12)"
                          : "rgba(99, 62, 165, 0.05)",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {navIcons[link.href as keyof typeof navIcons]}
                      </svg>
                    </span>
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div
          className="hidden lg:block"
          style={{
            paddingLeft: collapsed ? 88 : 276,
            transition: "padding-left 220ms ease",
          }}
        >
          {children}
        </div>
        <div className="lg:hidden">{children}</div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(18, 11, 36, 0.45)" }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 top-0 flex w-[82%] max-w-xs flex-col border-r border-[var(--border)] bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center">
              <div className="rounded-xl bg-[var(--shell)] px-2 py-2">
                <BrandLockup compact />
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="ml-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text-muted)]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m18 6-12 12" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setSearchOpen(true);
              }}
              className="mb-4 flex min-h-[48px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-muted)]"
            >
              <svg
                width="18"
                height="18"
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
              Search topics and articles
            </button>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-[52px] items-center rounded-2xl px-4 transition-colors"
                style={{
                  textDecoration: "none",
                  color: isActive(pathname, link.href)
                    ? "var(--accent)"
                    : "var(--text-body)",
                  backgroundColor: isActive(pathname, link.href)
                    ? "rgba(99, 62, 165, 0.12)"
                    : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

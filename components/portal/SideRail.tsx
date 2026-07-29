"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DISPLAY_PILLARS } from "@/lib/content/tree";

/**
 * Fixed 280px left rail for desktop (lg+): accordion of pillars → nodes.
 * The pillar containing the current article starts expanded; the active
 * node gets accent text + a hairline left rule.
 */
export default function SideRail() {
  const pathname = usePathname();

  // Which pillar is active (from /a/[pillar]/... or /p/[pillar]).
  const activePillarSlug = (() => {
    const m = pathname.match(/^\/(?:a|p)\/([^/]+)/);
    return m ? m[1] : null;
  })();
  const activeSlug = (() => {
    const m = pathname.match(/^\/a\/[^/]+\/([^/]+)/);
    return m ? m[1] : null;
  })();

  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const p of DISPLAY_PILLARS) init[p.id] = p.slug === activePillarSlug;
    return init;
  });

  return (
    <nav aria-label="Knowledge base" className="text-sm">
      <Link
        href="/browse"
        className="block mb-3 text-xs uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-body)]"
        style={{ textDecoration: "none" }}
      >
        Browse all topics
      </Link>
      <ul className="space-y-1">
        {DISPLAY_PILLARS.map((p) => {
          const isOpen = expanded[p.id];
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() =>
                  setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))
                }
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 py-1.5 text-left text-[var(--text-primary)]"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 text-[var(--text-muted)]"
                  style={{
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 150ms",
                  }}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                <span className="font-medium">{p.title}</span>
              </button>
              {isOpen && (
                <ul className="ml-[6px] border-l border-[var(--border)]">
                  {p.nodes.map((n) => {
                    const active = n.slug === activeSlug && p.slug === activePillarSlug;
                    return (
                      <li key={n.id}>
                        <Link
                          href={`/a/${n.pillarSlug}/${n.slug}`}
                          className="block py-1.5 pl-3 -ml-px border-l transition-colors"
                          style={{
                            textDecoration: "none",
                            borderColor: active
                              ? "var(--accent)"
                              : "transparent",
                            color: active
                              ? "var(--accent)"
                              : "var(--text-muted)",
                          }}
                        >
                          {n.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import { useState } from "react";
import { useLens } from "../lens/LensProvider";

/**
 * Wraps professional-depth content inside an article.
 * - Pro lens: expanded by default.
 * - Plain lens: collapsed behind a "Show professional detail" expander.
 * Used as an MDX component: <Advanced> ...markdown... </Advanced>
 */
export default function Advanced({ children }: { children: React.ReactNode }) {
  const { lens } = useLens();
  const [open, setOpen] = useState(false);
  const expanded = lens === "pro" || open;

  return (
    <div className="my-4 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 min-h-[44px] text-left text-sm font-medium text-[var(--accent)]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 150ms",
          }}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {expanded ? "Professional detail" : "Show professional detail"}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

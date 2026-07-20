"use client";

import { useLens, type Lens } from "./LensProvider";

const OPTIONS: { value: Lens; label: string }[] = [
  { value: "pro", label: "Pro" },
  { value: "plain", label: "Plain" },
];

/**
 * Segmented Pro/Plain control. Hidden when the lens is locked (forced).
 */
export default function LensToggle() {
  const { lens, setLens, locked } = useLens();
  if (locked) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Reading level"
      className="inline-flex items-center rounded-lg border border-[var(--border)] p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = lens === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setLens(o.value)}
            className="min-h-[36px] px-3 rounded-md text-sm transition-colors"
            style={{
              backgroundColor: active ? "var(--surface-2)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { SCENARIOS } from "@/lib/scenarios";

type Props = {
  onSelect: (scenarioId: string, label: string) => void;
  disabled?: boolean;
};

export default function ScenarioChips({ onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-5">
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id, s.label)}
          disabled={disabled}
          className="inline-flex items-center min-h-[44px] px-4 py-2 text-sm rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-[var(--accent)] mr-1.5">＋</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

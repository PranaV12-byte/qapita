"use client";

import { SCENARIOS } from "@/lib/scenarios";

type Props = {
  onSelect: (scenarioId: string, label: string) => void;
  disabled?: boolean;
};

export default function ScenarioChips({ onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id, s.label)}
          disabled={disabled}
          className="min-h-[44px] px-3 py-2 text-sm rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-body)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

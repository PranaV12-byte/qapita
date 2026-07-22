"use client";

export default function BrainStats({
  sources,
  passages,
  lastLintAt,
  linting,
  onRunLint,
  onErase,
}: {
  sources: number;
  passages: number;
  lastLintAt: string | null;
  linting: boolean;
  onRunLint: () => void;
  onErase: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex gap-4">
        <Stat label="Sources" value={String(sources)} />
        <Stat label="Passages" value={String(passages)} />
        <Stat
          label="Last health check"
          value={lastLintAt ? new Date(lastLintAt).toLocaleDateString() : "—"}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onRunLint}
          disabled={linting}
          className="rounded-lg border border-[var(--border)] text-sm text-[var(--text-body)] px-3 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {linting ? "Checking…" : "Run health check"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Erase your entire wiki? This removes all your uploaded sources. The shared foundation stays.")) {
              onErase();
            }
          }}
          className="rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] px-3 hover:border-[var(--danger)] hover:text-[var(--danger)]"
          style={{ minHeight: 44 }}
        >
          Erase my wiki
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-head text-[var(--text-head)]">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

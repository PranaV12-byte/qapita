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
    <div className="q-shell-card flex flex-wrap items-center gap-4 p-5">
      <div className="flex gap-4">
        <Stat label="Sources" value={String(sources)} />
        <Stat label="Passages" value={String(passages)} />
        <Stat
          label="Last health check"
          value={lastLintAt ? new Date(lastLintAt).toLocaleDateString() : "Not run"}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onRunLint}
          disabled={linting}
          className="rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--text-body)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {linting ? "Checking..." : "Run health check"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Erase the entire workspace? This removes uploaded sources while leaving the shared foundation intact."
              )
            ) {
              onErase();
            }
          }}
          className="rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
          style={{ minHeight: 44 }}
        >
          Erase workspace
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-head text-[var(--text-head)]">{value}</div>
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}

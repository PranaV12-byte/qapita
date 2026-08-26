"use client";

import type { LintReport } from "@/lib/brain/lint";

export default function LintPanel({
  report,
  onApply,
}: {
  report: LintReport | null;
  onApply: (findingId: string, action: "apply" | "dismiss") => void;
}) {
  if (!report) return null;

  const open = report.findings.filter(
    (f) => !report.dismissed.includes(f.id) && !report.applied.includes(f.id)
  );

  if (open.length === 0) {
    return (
      <p className="text-sm text-[var(--certified)]">
        Health check passed - no issues found in your wiki.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-muted)]">
        {open.length} thing{open.length === 1 ? "" : "s"} to review · checked{" "}
        {new Date(report.generatedAt).toLocaleString()}
      </p>
      {open.map((f) => (
        <div
          key={f.id}
          className="rounded-lg border p-3"
          style={{ borderColor: f.severity === "warn" ? "var(--draft)" : "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-body)]">{f.message}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{f.suggestedAction}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {f.autoApplicable && (
                <button
                  type="button"
                  onClick={() => onApply(f.id, "apply")}
                  className="rounded border border-[var(--border)] text-xs text-[var(--accent)] px-2 hover:border-[var(--accent)]"
                  style={{ minHeight: 36 }}
                >
                  Fix
                </button>
              )}
              <button
                type="button"
                onClick={() => onApply(f.id, "dismiss")}
                className="rounded border border-[var(--border)] text-xs text-[var(--text-muted)] px-2 hover:border-[var(--text-body)]"
                style={{ minHeight: 36 }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

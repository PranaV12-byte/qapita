"use client";

import { getNode } from "@/lib/content/tree";
import type { BrainSourceMeta } from "@/lib/brain/store";

function topicLabels(nodeIds: string[]): string {
  if (nodeIds.length === 0) return "—";
  return nodeIds
    .map((id) => getNode(id)?.title ?? (id.startsWith("u-") ? "new topic" : id))
    .join(", ");
}

export default function SourceTable({
  sources,
  onDelete,
  onFocus,
}: {
  sources: BrainSourceMeta[];
  onDelete: (sourceId: string) => void;
  onFocus: (sourceId: string) => void;
}) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No sources yet — the graph above is the shared foundation everyone starts with. Add a file to make it yours.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
            <th className="py-2 pr-3 font-medium">Source</th>
            <th className="py-2 pr-3 font-medium">Type</th>
            <th className="py-2 pr-3 font-medium">Topics</th>
            <th className="py-2 pr-3 font-medium text-right">Passages</th>
            <th className="py-2 pr-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.sourceId} className="border-b border-[var(--border)]">
              <td className="py-2 pr-3">
                <button
                  type="button"
                  onClick={() => onFocus(s.sourceId)}
                  className="text-[var(--accent)] hover:underline text-left"
                >
                  {s.fileName}
                </button>
              </td>
              <td className="py-2 pr-3 text-[var(--text-muted)] uppercase text-xs">{s.format}</td>
              <td className="py-2 pr-3 text-[var(--text-body)]">{topicLabels(s.nodeIds)}</td>
              <td className="py-2 pr-3 text-right text-[var(--text-body)]">{s.passageCount}</td>
              <td className="py-2 pr-3 text-right">
                <button
                  type="button"
                  aria-label={`Remove ${s.fileName}`}
                  onClick={() => {
                    if (confirm(`Remove "${s.fileName}" from your wiki?`)) onDelete(s.sourceId);
                  }}
                  className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]"
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

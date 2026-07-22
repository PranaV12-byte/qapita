"use client";

import type { RenderNode } from "@/lib/brain/graph";
import type { BrainSourceMeta } from "@/lib/brain/store";

// Side panel (desktop) / bottom sheet (mobile) for a selected graph node.
// Shows its summary, the sources feeding it, backlinks (answers that cited
// it), and an "Ask about this" action that seeds the chat.
export default function NodePanel({
  node,
  sources,
  onClose,
  onAsk,
}: {
  node: RenderNode | null;
  sources: BrainSourceMeta[];
  onClose: () => void;
  onAsk: (node: RenderNode) => void;
}) {
  if (!node) return null;

  const feeding =
    node.feedingSourceIds && node.feedingSourceIds.length > 0
      ? sources.filter((s) => node.feedingSourceIds!.includes(s.sourceId))
      : [];

  return (
    <aside
      className="border border-[var(--border)] rounded-xl bg-[var(--surface-1)] p-4 flex flex-col gap-3"
      aria-label={`Details for ${node.label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {node.kind === "source"
              ? "Your source"
              : node.kind === "user-node"
                ? "Your topic"
                : node.kind === "pillar"
                  ? "Pillar"
                  : "Topic"}
          </p>
          <h3 className="font-head text-lg text-[var(--text-head)]">{node.label}</h3>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-body)]"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          ✕
        </button>
      </div>

      {node.summary && <p className="text-sm text-[var(--text-body)]">{node.summary}</p>}

      {node.passageCount !== undefined && (
        <p className="text-xs text-[var(--text-muted)]">{node.passageCount} passages</p>
      )}

      {feeding.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">Fed by your sources</p>
          <ul className="text-sm text-[var(--text-body)] space-y-0.5">
            {feeding.map((s) => (
              <li key={s.sourceId}>• {s.fileName}</li>
            ))}
          </ul>
        </div>
      )}

      {node.feedsNodeIds && node.feedsNodeIds.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Feeds {node.feedsNodeIds.length} topic{node.feedsNodeIds.length === 1 ? "" : "s"}
        </p>
      )}

      {node.citedByAnswers !== undefined && node.citedByAnswers > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Cited by {node.citedByAnswers} of your past answer{node.citedByAnswers === 1 ? "" : "s"}
        </p>
      )}

      {node.kind !== "source" && (
        <button
          type="button"
          onClick={() => onAsk(node)}
          className="mt-1 inline-flex items-center justify-center rounded-lg bg-[var(--accent-solid)] text-[var(--accent-on)] px-4 font-medium"
          style={{ minHeight: 44 }}
        >
          Ask about this
        </button>
      )}
    </aside>
  );
}

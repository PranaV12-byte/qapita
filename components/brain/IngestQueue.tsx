"use client";

import { useState } from "react";
import { getNode } from "@/lib/content/tree";
import type { JobView } from "@/lib/brain/jobs";

export type QueuedJob = { jobId: string; fileName: string; view: JobView | null };

const STAGE_LABEL: Record<string, string> = {
  extracting: "Reading the file…",
  vetting: "Health check…",
  weaving: "Weaving into your wiki…",
  done: "Added",
  "needs-review": "Needs your review",
  blocked: "Not added",
};

function nodeLabel(nodeId: string): string {
  return getNode(nodeId)?.title ?? (nodeId.startsWith("u-") ? "a new topic" : nodeId);
}

export default function IngestQueue({
  jobs,
  onConfirm,
  onFocusNode,
}: {
  jobs: QueuedJob[];
  onConfirm: (jobId: string, action: "add" | "discard", nodeId?: string) => void;
  onFocusNode: (nodeId: string) => void;
}) {
  if (jobs.length === 0) return null;
  return (
    <div className="space-y-2">
      {jobs.map((j) => (
        <JobCard key={j.jobId} job={j} onConfirm={onConfirm} onFocusNode={onFocusNode} />
      ))}
    </div>
  );
}

function JobCard({
  job,
  onConfirm,
  onFocusNode,
}: {
  job: QueuedJob;
  onConfirm: (jobId: string, action: "add" | "discard", nodeId?: string) => void;
  onFocusNode: (nodeId: string) => void;
}) {
  const [topic, setTopic] = useState("");
  const v = job.view;
  const stage = v?.stage ?? "extracting";
  const busy = stage === "extracting" || stage === "vetting" || stage === "weaving";
  // Real per-passage progress during the weave (V0); a pulse otherwise.
  const prog = v?.progress ?? null;
  const pct = stage === "weaving" && prog && prog.total > 0
    ? Math.round((prog.current / prog.total) * 100)
    : null;

  return (
    <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface-1)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--text-primary)] truncate">{job.fileName}</span>
        <span className="text-xs text-[var(--text-muted)] shrink-0">
          {STAGE_LABEL[stage]}
          {pct !== null ? ` · ${pct}%` : ""}
        </span>
      </div>

      {busy && (
        <div className="mt-2 h-1 rounded bg-[var(--surface-2)] overflow-hidden">
          {pct !== null ? (
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: "var(--accent)" }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse" style={{ background: "var(--accent)" }} />
          )}
        </div>
      )}

      {/* Done → weave report */}
      {stage === "done" && v?.weaveReport && (
        <div className="mt-2 text-xs text-[var(--text-body)]">
          <p className="mb-1">
            {v.weaveReport.totalPassages} passage
            {v.weaveReport.totalPassages === 1 ? "" : "s"} woven in:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(v.weaveReport.perNode).map(([nodeId, count]) => (
              <button
                key={nodeId}
                type="button"
                onClick={() => onFocusNode(nodeId)}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--accent)] hover:border-[var(--accent)]"
              >
                {nodeLabel(nodeId)} ({count})
              </button>
            ))}
          </div>
          {v.weaveReport.newNodes.length > 0 && (
            <p className="mt-1 text-[var(--text-muted)]">
              Created new topic{v.weaveReport.newNodes.length === 1 ? "" : "s"}:{" "}
              {v.weaveReport.newNodes.map((n) => n.title).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Needs review (warn) */}
      {stage === "needs-review" && v?.health && (
        <div className="mt-2 text-xs">
          <ul className="text-[var(--draft)] mb-2 space-y-0.5">
            {v.health.reasons.map((r, i) => (
              <li key={i}>• {r.message}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-body)] px-2"
              style={{ fontSize: "16px", minHeight: 44 }}
            >
              <option value="">Choose a placement</option>
              {v.health.suggestedNodeId && (
                <option value={v.health.suggestedNodeId}>
                  Suggested: {nodeLabel(v.health.suggestedNodeId)}
                </option>
              )}
            </select>
            <button
              type="button"
              onClick={() => onConfirm(job.jobId, "add", topic || undefined)}
              className="rounded-lg bg-[var(--accent-solid)] text-[var(--accent-on)] px-3 font-medium"
              style={{ minHeight: 44 }}
            >
              Add anyway
            </button>
            <button
              type="button"
              onClick={() => onConfirm(job.jobId, "discard")}
              className="rounded-lg border border-[var(--border)] text-[var(--text-body)] px-3 hover:border-[var(--danger)]"
              style={{ minHeight: 44 }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Blocked (fail / discarded) */}
      {stage === "blocked" && (
        <p className="mt-2 text-xs text-[var(--danger)]">
          {v?.extractFailure?.message ?? v?.health?.reasons[0]?.message ?? v?.error ?? "Could not add this file."}
        </p>
      )}
    </div>
  );
}

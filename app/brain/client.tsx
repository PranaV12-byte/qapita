"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrainGraph from "@/components/brain/BrainGraph";
import UploadDropzone from "@/components/brain/UploadDropzone";
import IngestQueue, { type QueuedJob } from "@/components/brain/IngestQueue";
import SourceTable from "@/components/brain/SourceTable";
import BrainStats from "@/components/brain/BrainStats";
import LintPanel from "@/components/brain/LintPanel";
import NodePanel from "@/components/brain/NodePanel";
import type { GraphModel, RenderNode } from "@/lib/brain/graph";
import type { BrainSourceMeta } from "@/lib/brain/store";
import type { JobView } from "@/lib/brain/jobs";
import type { LintReport } from "@/lib/brain/lint";

type Props = {
  brainId: string;
  model: GraphModel;
  sources: BrainSourceMeta[];
  counts: { sources: number; passages: number };
  lint: { lastLintAt: string | null; appendsSinceLint: number };
  lintReport: LintReport | null;
};

const TERMINAL = new Set(["done", "blocked", "needs-review"]);

export default function BrainClient({ brainId, model, sources, counts, lint, lintReport }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<QueuedJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linting, setLinting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [listView, setListView] = useState(false);

  const focusIds = useMemo(() => {
    const f = searchParams.get("focus");
    return f ? f.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams]);

  const selectedNode: RenderNode | null = useMemo(
    () => model.nodes.find((n) => n.id === selectedId) ?? null,
    [model.nodes, selectedId]
  );

  // ── Upload ──
  const onFiles = useCallback(async (files: File[]) => {
    setBanner(null);
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const res = await fetch("/api/brain/sources", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setBanner(data.message ?? "Upload failed.");
      return;
    }
    setJobs((prev) => [
      ...data.jobs.map((j: { jobId: string; fileName: string }) => ({ ...j, view: null })),
      ...prev,
    ]);
  }, []);

  // ── Poll active jobs ──
  useEffect(() => {
    const active = jobs.filter((j) => !j.view || !TERMINAL.has(j.view.stage));
    if (active.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const updates = await Promise.all(
        active.map(async (j) => {
          try {
            const res = await fetch(`/api/brain/ingest/${j.jobId}`);
            if (!res.ok) return null;
            return { jobId: j.jobId, view: (await res.json()) as JobView };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      let anyDone = false;
      setJobs((prev) =>
        prev.map((j) => {
          const u = updates.find((x) => x && x.jobId === j.jobId);
          if (u) {
            if (u.view.stage === "done" && (!j.view || j.view.stage !== "done")) anyDone = true;
            return { ...j, view: u.view };
          }
          return j;
        })
      );
      if (anyDone) router.refresh(); // pull the fresh graph + sources
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobs, router]);

  const onConfirm = useCallback(
    async (jobId: string, action: "add" | "discard", nodeId?: string) => {
      const res = await fetch(`/api/brain/ingest/${jobId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, nodeId }),
      });
      if (res.ok) {
        const view = (await res.json()) as JobView;
        setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, view } : j)));
        if (view.stage === "done") router.refresh();
      }
    },
    [router]
  );

  const onDelete = useCallback(
    async (sourceId: string) => {
      await fetch(`/api/brain/sources/${sourceId}`, { method: "DELETE" });
      setSelectedId(null);
      router.refresh();
    },
    [router]
  );

  const onErase = useCallback(async () => {
    await fetch("/api/brain", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmBrainId: brainId }),
    });
    setJobs([]);
    setSelectedId(null);
    router.refresh();
  }, [brainId, router]);

  const onRunLint = useCallback(async () => {
    setLinting(true);
    try {
      await fetch("/api/brain/lint", { method: "POST" });
      router.refresh();
    } finally {
      setLinting(false);
    }
  }, [router]);

  const onApplyFinding = useCallback(
    async (findingId: string, action: "apply" | "dismiss") => {
      await fetch("/api/brain/lint/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId, action }),
      });
      router.refresh();
    },
    [router]
  );

  const focusNode = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    document.getElementById("brain-graph")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const onAsk = useCallback(
    (node: RenderNode) => {
      const nodeParam = node.kind === "topic" ? `?nodeId=${encodeURIComponent(node.id)}` : "";
      router.push(`/generate${nodeParam}`);
    },
    [router]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header>
        <h1 className="font-head text-heading text-3xl mb-1">My Brain</h1>
        <p className="text-[var(--text-body)] text-sm">
          Your personal equity-comp wiki. It starts as the shared foundation below; add your own
          files and they&apos;re woven in. Every question you ask is answered against this graph.
        </p>
      </header>

      <BrainStats
        sources={counts.sources}
        passages={counts.passages}
        lastLintAt={lint.lastLintAt}
        linting={linting}
        onRunLint={onRunLint}
        onErase={onErase}
      />

      {banner && (
        <p className="text-sm text-[var(--danger)] border border-[var(--danger)] rounded-lg px-3 py-2">
          {banner}
        </p>
      )}

      <UploadDropzone onFiles={onFiles} />
      <IngestQueue jobs={jobs} onConfirm={onConfirm} onFocusNode={focusNode} />

      {/* Graph + node detail */}
      <section id="brain-graph">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-head text-heading text-xl">The graph</h2>
          <button
            type="button"
            onClick={() => setListView((v) => !v)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] underline"
          >
            {listView ? "Graph view" : "List view"}
          </button>
        </div>

        {listView ? (
          <ListView model={model} onSelect={setSelectedId} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div
              className="rounded-xl border border-[var(--border)] overflow-hidden"
              style={{ height: 520 }}
            >
              <BrainGraph
                model={model}
                focusIds={focusIds}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            {selectedNode ? (
              <NodePanel
                node={selectedNode}
                sources={sources}
                onClose={() => setSelectedId(null)}
                onAsk={onAsk}
              />
            ) : (
              <div className="hidden lg:flex items-center justify-center text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-xl p-4 text-center">
                Click any node to see its summary, sources, and backlinks.
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-head text-heading text-xl mb-2">Your sources</h2>
        <SourceTable sources={sources} onDelete={onDelete} onFocus={(id) => focusNode(`source:${id}`)} />
      </section>

      <section>
        <h2 className="font-head text-heading text-xl mb-2">Health check</h2>
        <LintPanel report={lintReport} onApply={onApplyFinding} />
      </section>
    </div>
  );
}

// Accessible / mobile fallback: the same nodes as a plain nested list.
function ListView({ model, onSelect }: { model: GraphModel; onSelect: (id: string) => void }) {
  const pillars = model.nodes.filter((n) => n.kind === "pillar");
  return (
    <div className="border border-[var(--border)] rounded-xl p-4 space-y-3">
      {pillars.map((p) => {
        const topics = model.edges
          .filter((e) => e.kind === "tree" && e.from === p.id)
          .map((e) => model.nodes.find((n) => n.id === e.to))
          .filter((n): n is RenderNode => !!n);
        return (
          <div key={p.id}>
            <p className="font-head text-[var(--text-head)]">{p.label}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="text-xs rounded border border-[var(--border)] px-2 py-1 text-[var(--text-body)] hover:border-[var(--accent)]"
                  style={{ minHeight: 36 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

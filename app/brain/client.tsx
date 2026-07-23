"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrainGraph from "@/components/brain/BrainGraph";
import UploadDropzone from "@/components/brain/UploadDropzone";
import IngestQueue, { type QueuedJob } from "@/components/brain/IngestQueue";
import SourceTable from "@/components/brain/SourceTable";
import BrainStats from "@/components/brain/BrainStats";
import LintPanel from "@/components/brain/LintPanel";
import NotePane from "@/components/brain/NotePane";
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
type NoteKind = "topic" | "source" | "user-node" | "general" | "pillar";

export default function BrainClient({ brainId, model, sources, counts, lint, lintReport }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<QueuedJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linting, setLinting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [listView, setListView] = useState(false);
  const initialRead = useRef(false);

  const focusIds = useMemo(() => {
    const f = searchParams.get("focus");
    return f ? f.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams]);

  const nodeIdSet = useMemo(() => new Set(model.nodes.map((n) => n.id)), [model.nodes]);

  // title (label) → node id, for resolving [[wiki-links]] in note bodies.
  const titleToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of model.nodes) m.set(n.label.trim().toLowerCase(), n.id);
    return m;
  }, [model.nodes]);
  const resolveTitle = useCallback(
    (title: string) => titleToId.get(title.trim().toLowerCase()) ?? null,
    [titleToId]
  );

  // Selecting a node opens its note; sync ?note= without a server round-trip.
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("note", id);
    else url.searchParams.delete("note");
    window.history.replaceState(null, "", url);
  }, []);

  // Deep links: ?note=<id> opens that note; a citation's ?focus=<id> resolves
  // to a node (source:<id> or a bare node id) and opens it too. Runs once.
  useEffect(() => {
    if (initialRead.current) return;
    initialRead.current = true;
    const note = searchParams.get("note");
    if (note && nodeIdSet.has(note)) {
      setSelectedId(note);
      return;
    }
    const focus = focusIds[0];
    if (focus) {
      const resolved = nodeIdSet.has(`source:${focus}`)
        ? `source:${focus}`
        : nodeIdSet.has(focus)
          ? focus
          : null;
      if (resolved) setSelectedId(resolved);
    }
  }, [searchParams, focusIds, nodeIdSet]);

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
    }, 500);
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
      select(null);
      router.refresh();
    },
    [router, select]
  );

  const onErase = useCallback(async () => {
    await fetch("/api/brain", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmBrainId: brainId }),
    });
    setJobs([]);
    select(null);
    router.refresh();
  }, [brainId, router, select]);

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

  const focusNode = useCallback(
    (nodeId: string) => {
      select(nodeId);
      document.getElementById("brain-graph")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [select]
  );

  const onAsk = useCallback(
    (id: string, kind: NoteKind) => {
      const nodeParam = kind === "topic" ? `?nodeId=${encodeURIComponent(id)}` : "";
      router.push(`/generate${nodeParam}`);
    },
    [router]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-heading text-3xl mb-1">My Brain</h1>
          <p className="text-[var(--text-body)] text-sm max-w-2xl">
            Your personal equity-comp wiki — the shared foundation with your own files woven in.
            Explore the graph, click any node to read it, and every question you ask is answered
            against this graph.
          </p>
        </div>
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

      {/* Graph-first main view + note reader */}
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
          <ListView model={model} onSelect={select} />
        ) : (
          <div
            className="relative rounded-xl border border-[var(--border)] overflow-hidden"
            style={{ height: "min(70vh, 640px)", minHeight: 460 }}
          >
            <BrainGraph model={model} focusIds={focusIds} selectedId={selectedId} onSelect={select} />
            <NotePane
              noteId={selectedId}
              resolveTitle={resolveTitle}
              onNavigate={select}
              onClose={() => select(null)}
              onAsk={onAsk}
              onDeleteSource={onDelete}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Tip: scroll to zoom, drag to pan, drag a node to reposition it, press{" "}
          <kbd className="px-1 rounded border border-[var(--border)]">Ctrl</kbd>+
          <kbd className="px-1 rounded border border-[var(--border)]">K</kbd> to jump to any note.
        </p>
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

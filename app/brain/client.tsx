"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrainGraph from "@/components/brain/BrainGraph";
import UploadDropzone from "@/components/brain/UploadDropzone";
import IngestQueue, { type QueuedJob } from "@/components/brain/IngestQueue";
import BrainStats from "@/components/brain/BrainStats";
import NotePane from "@/components/brain/NotePane";
import type { GraphModel } from "@/lib/brain/graph";
import type { JobView } from "@/lib/brain/jobs";

type Props = {
  brainId: string;
  model: GraphModel;
  counts: { sources: number; passages: number };
  lint: { lastLintAt: string | null; appendsSinceLint: number };
};

const TERMINAL = new Set(["done", "blocked", "needs-review"]);
type NoteKind = "topic" | "source" | "user-node" | "general" | "pillar";

export default function BrainClient({ brainId, model, counts, lint }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<QueuedJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linting, setLinting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
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
        <div className="mb-2">
          <h2 className="font-head text-heading text-xl">The graph</h2>
        </div>

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
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Tip: scroll to zoom, drag to pan, drag a node to reposition it, press{" "}
          <kbd className="px-1 rounded border border-[var(--border)]">Ctrl</kbd>+
          <kbd className="px-1 rounded border border-[var(--border)]">K</kbd> to jump to any note.
        </p>
      </section>
    </div>
  );
}

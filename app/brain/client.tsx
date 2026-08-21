"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrainGraph, { type CoverageSummary } from "@/components/brain/BrainGraph";
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
  const [brainView, setBrainView] = useState<"sources" | "graph">("sources");
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const initialRead = useRef(false);

  const focusIds = useMemo(() => {
    const f = searchParams.get("focus");
    return f ? f.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams]);

  const nodeIdSet = useMemo(() => new Set(model.nodes.map((n) => n.id)), [model.nodes]);

  const coverage = useMemo<CoverageSummary>(() => {
    const topics = model.nodes.filter((node) => node.kind === "topic");
    const coveredTopics = topics.filter((node) => (node.feedingSourceIds?.length ?? 0) > 0);
    const coveredTopicIds = coveredTopics.map((node) => node.id);
    const coveredTopicSet = new Set(coveredTopicIds);
    const coveredSourceIds = model.nodes
      .filter((node) => node.kind === "source")
      .filter((node) => node.feedsNodeIds?.some((id) => coveredTopicSet.has(id)) || coveredTopics.some((topic) => topic.feedingSourceIds?.includes(node.id.replace(/^source:/, ""))))
      .map((node) => node.id);
    return {
      totalTopics: topics.length,
      coveredTopics: coveredTopics.length,
      percent: topics.length ? Math.round((coveredTopics.length / topics.length) * 100) : 0,
      coveredTopicIds,
      coveredSourceIds,
    };
  }, [model.nodes]);

  const titleToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of model.nodes) {
      map.set(node.label.trim().toLowerCase(), node.id);
    }
    return map;
  }, [model.nodes]);

  const resolveTitle = useCallback(
    (title: string) => titleToId.get(title.trim().toLowerCase()) ?? null,
    [titleToId]
  );

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("note", id);
    else url.searchParams.delete("note");
    window.history.replaceState(null, "", url);
  }, []);

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

  const onFiles = useCallback(async (files: File[]) => {
    setBanner(null);
    const fd = new FormData();
    files.forEach((file) => fd.append("files", file));
    const res = await fetch("/api/brain/sources", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setBanner(data.message ?? "Upload failed.");
      return;
    }
    setJobs((prev) => [
      ...data.jobs.map((job: { jobId: string; fileName: string }) => ({
        ...job,
        view: null,
      })),
      ...prev,
    ]);
  }, []);

  useEffect(() => {
    const active = jobs.filter((job) => !job.view || !TERMINAL.has(job.view.stage));
    if (active.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const updates = await Promise.all(
        active.map(async (job) => {
          try {
            const res = await fetch(`/api/brain/ingest/${job.jobId}`);
            if (!res.ok) return null;
            return { jobId: job.jobId, view: (await res.json()) as JobView };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      let anyDone = false;
      setJobs((prev) =>
        prev.map((job) => {
          const update = updates.find((item) => item && item.jobId === job.jobId);
          if (update) {
            if (update.view.stage === "done" && (!job.view || job.view.stage !== "done")) {
              anyDone = true;
            }
            return { ...job, view: update.view };
          }
          return job;
        })
      );
      if (anyDone) router.refresh();
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
        setJobs((prev) => prev.map((job) => (job.jobId === jobId ? { ...job, view } : job)));
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
      document.getElementById("brain-graph")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
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

  return <div className="v9-brain-page">
    <div className="v9-brain-mobile-tabs"><button onClick={() => setBrainView("sources")} className={brainView === "sources" ? "is-active" : ""}>Sources</button><button onClick={() => setBrainView("graph")} className={brainView === "graph" ? "is-active" : ""}>Graph</button></div>
    {banner && <p className="v9-brain-banner">{banner}</p>}
    <div className="v9-brain-workspace">
      <aside className={`v9-brain-sources ${brainView === "sources" ? "is-visible" : ""}`}>
        <div className="v9-brain-source-head"><div><p className="v9-eyebrow">Brain</p><h1>Your documents</h1><p>Add trusted plan material and see where it connects to the Knowledge Tree.</p></div><div className="relative"><button type="button" className="v9-brain-more" aria-label="Workspace actions" aria-expanded={maintenanceOpen} onClick={() => setMaintenanceOpen((current) => !current)}>•••</button>{maintenanceOpen && <div className="v9-brain-actions"><button onClick={() => { setMaintenanceOpen(false); onRunLint(); }} disabled={linting}>{linting ? "Checking..." : "Run workspace check"}</button><button className="is-danger" onClick={() => { setMaintenanceOpen(false); if (window.confirm("Erase the entire workspace? This removes uploaded sources while leaving the shared foundation intact.")) onErase(); }}>Erase workspace</button></div>}</div></div>
        <BrainStats sources={counts.sources} passages={counts.passages} lastLintAt={lint.lastLintAt} coverage={coverage} />
        <div className="v9-brain-upload"><UploadDropzone onFiles={onFiles} /></div>
        <IngestQueue jobs={jobs} onConfirm={onConfirm} onFocusNode={focusNode} />
      </aside>
      <section id="brain-graph" className={`v9-brain-graph ${brainView === "graph" ? "is-visible" : ""}`}>
        <div className="v9-graph-topline"><div><p className="v9-eyebrow">Knowledge map</p><h2>Connected graph</h2></div><div className="v9-graph-legend"><span><i className="is-purple" />EquityIQ topics</span><span><i className="is-yellow" />Company sources</span></div></div>
        <div className="v9-graph-canvas"><BrainGraph model={model} focusIds={focusIds} selectedId={selectedId} onSelect={select} coverage={coverage} /><NotePane noteId={selectedId} resolveTitle={resolveTitle} onNavigate={select} onClose={() => select(null)} onAsk={onAsk} onDeleteSource={onDelete} /></div>
        <div className="v9-coverage"><div><strong>Your coverage</strong><span>{coverage.coveredTopics} of {coverage.totalTopics} topics connected</span></div><div className="v9-coverage-track"><i style={{ width: `${coverage.percent}%` }} /></div><b>{coverage.percent}%</b></div>
        <p className="v9-graph-help">Scroll to zoom, drag to pan, drag a node to reposition it, or press Ctrl + K to find a note.</p>
      </section>
    </div>
  </div>;
}

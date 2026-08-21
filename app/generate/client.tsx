"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ArtifactResult from "@/components/ArtifactResult";
import { SCENARIOS } from "@/lib/scenarios";
import { getNode } from "@/lib/content/tree";
import {
  DEFAULT_PLACEHOLDER,
  getNodePlaceholder,
  isSubmitDisabled,
} from "@/lib/generate-utils";

type Citation = {
  kind?: "topic" | "source" | "user-node";
  nodeId?: string;
  sourceId?: string;
  title: string;
};

type ApiResponse = {
  artifactId: string;
  title: string;
  bodyMarkdown: string;
  quickShare: string;
  citations: Citation[];
  status: string;
  fallbackUsed: boolean;
  fallbackScenario?: { id: string; label: string };
  scenario: { id: string; label: string } | null;
  logged: boolean;
};

type Turn = { id: number; query: string; result: ApiResponse };

type Props = {
  initialQuery?: string;
  initialNodeId?: string;
  showBanner?: boolean;
};

export default function GenerateClient({
  initialQuery = "",
  initialNodeId,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [nodeId, setNodeId] = useState<string | undefined>(initialNodeId);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"searching" | "drafting">(
    "searching"
  );
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [wikiSources, setWikiSources] = useState(0);
  const [hideExamples, setHideExamples] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("equityiq:drafts");
      if (saved) {
        const parsed = JSON.parse(saved) as Turn[];
        if (Array.isArray(parsed)) setTurns(parsed.slice(0, 3));
      }
    } catch {
      sessionStorage.removeItem("equityiq:drafts");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      sessionStorage.setItem("equityiq:drafts", JSON.stringify(turns.slice(0, 3)));
    } catch {
      // Persistence is optional; draft generation still works without browser storage.
    }
  }, [storageReady, turns]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brain")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.counts) {
          setWikiSources(data.counts.sources ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (turns.length > 0) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [turns.length]);

  const nodeTitle = nodeId ? getNode(nodeId)?.title : undefined;
  const placeholder = nodeTitle
    ? getNodePlaceholder(nodeTitle)
    : DEFAULT_PLACEHOLDER;

  const doSubmit = async (submitQuery: string, scenarioId?: string) => {
    if (!scenarioId && !submitQuery.trim()) {
      setEmptyHint(true);
      return;
    }

    setEmptyHint(false);
    setLoading(true);
    setLoadingStage("searching");
    setError(false);
    setOffline(false);
    setLastQuery(submitQuery);
    setHideExamples(true);

    const timer = setTimeout(() => setLoadingStage("drafting"), 600);

    try {
      const body: Record<string, string> = {};
      if (scenarioId) {
        body.scenarioId = scenarioId;
      } else {
        body.query = submitQuery;
        if (nodeId) body.nodeId = nodeId;
      }

      const response = await fetch("/api/artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as ApiResponse;
      setTurns((current) => [
        {
          id: Date.now(),
          query: submitQuery || data.scenario?.label || "Draft request",
          result: data,
        },
        ...current,
      ]);
    } catch {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      setOffline(isOffline);
      setError(true);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    doSubmit(query);
  };

  return (
    <div className="v9-ask-page">
      <section className="v9-ask-hero"><div><p className="v9-eyebrow">Ask a question</p><h1>What do you need to communicate?</h1><p>Describe the situation. EquityIQ will prepare a clear first draft and point you to the related guidance.</p></div></section>
      <div className="v9-ask-wrap">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="v9-ask-card">
          <div className="v9-ask-card-head">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Drafts
            </p>
            <h2>Prepare a draft</h2><p>Use the details employees need to understand, then review the draft before you share it.</p>
          </div>

          <div className="grid gap-6 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-5">
              {nodeId && nodeTitle && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[var(--accent)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Starting from: {nodeTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNodeId(undefined)}
                    className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-[var(--text-muted)]"
                    aria-label="Remove topic context"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m18 6-12 12" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                  Describe the communication you need
                </label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  rows={6}
                  disabled={loading}
                  className="v9-ask-textarea"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Include the audience, the change or event, and the outcome you want employees to understand.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled(query, loading)}
                  className="v9-primary-button disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Generate draft
                </button>
                <Link
                  href="/browse"
                  className="v9-secondary-button"
                  style={{ textDecoration: "none" }}
                >
                  Browse the library
                </Link>
              </div>

              {wikiSources > 0 && (
                <p className="text-sm text-[var(--text-muted)]">
                  Your workspace currently includes {wikiSources} source{wikiSources === 1 ? "" : "s"} that can support future drafts.
                </p>
              )}

              {emptyHint && (
                <p className="text-sm text-[var(--danger)]">
                  Add a prompt before preparing the draft.
                </p>
              )}

              {error && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
                  {offline ? (
                    <p className="text-sm text-[var(--text-body)]">
                      A connection is required to prepare a draft. Reading and search remain available while you are offline.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <h2 className="font-head text-2xl text-[var(--text-head)]">
                        The draft could not be prepared
                      </h2>
                      <p className="text-sm text-[var(--text-body)]">
                        The request did not complete. Try again from the same prompt.
                      </p>
                      <button
                        onClick={() => doSubmit(lastQuery)}
                        className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--accent-solid)] px-4 text-sm font-semibold text-white"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="v9-ask-aside">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  What happens next
                </p>
                <div className="mt-4 space-y-4">
                  {[
                    ["1", "We prepare the draft", "A professional first version is created from the prompt and supporting context."],
                    ["2", "You review related topics", "Browse the library topics connected to the communication."],
                    ["3", "You add company sources if needed", "Bring in local context when future drafts should reflect your program."],
                  ].map(([step, title, body]) => (
                    <div key={step} className="flex gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[var(--accent)]">
                        {step}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-body)]">
                          {body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!hideExamples && (
                <div className="v9-ask-examples">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Try an example
                  </p>
                  <div className="mt-4 space-y-3">
                    {SCENARIOS.slice(0, 3).map((scenario) => (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => doSubmit("", scenario.id)}
                        className="v9-example-button"
                      >
                        <span>{scenario.label}</span>
                        <span className="text-[var(--accent)]">Go</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href="/brain"
                className="v9-ask-source-link"
                style={{ textDecoration: "none" }}
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Optional next step
                </p>
                <h2 className="mt-2 font-head text-2xl text-[var(--text-head)]">
                  Add company sources
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--text-body)]">
                  Upload plan documents, memos, or policy files to support future drafts without changing the shared library.
                </p>
              </Link>
            </aside>
          </div>
        </section>
      </div>

      {loading && (
        <section className="v9-loading-card">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            {loadingStage === "searching" ? "Reviewing the library" : "Preparing the draft"}
          </p>
          <div className="mt-5 space-y-3">
            {[92, 88, 80, 72, 84].map((width, index) => (
              <div
                key={index}
                className="h-4 animate-pulse rounded-full bg-[var(--surface-2)]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </section>
      )}

      {turns.length > 0 && (
        <div ref={resultRef} className="v9-result-stack">
          {turns.map((turn) => (
            <section key={turn.id} className="space-y-4">
              <div className="v9-working-request">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Working request
                </p>
                <p className="mt-2 text-lg leading-8 text-[var(--text-primary)]">
                  {turn.query}
                </p>
              </div>
              {turn.result.fallbackUsed && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 text-sm leading-7 text-[var(--text-body)]">
                  This request was aligned to the closest drafting scenario currently available in the library:
                  {" "}
                  <strong>
                    {(turn.result.fallbackScenario ?? turn.result.scenario)?.label}
                  </strong>
                  .
                </div>
              )}
              <ArtifactResult
                artifactId={turn.result.artifactId}
                title={turn.result.title}
                bodyMarkdown={turn.result.bodyMarkdown}
                quickShare={turn.result.quickShare}
                citations={turn.result.citations}
              />
            </section>
          ))}
        </div>
      )}
      </div></div>
  );
}

"use client";

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
  const resultRef = useRef<HTMLDivElement>(null);

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
        { id: Date.now(), query: submitQuery || data.scenario?.label || "Draft request", result: data },
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
    <div className="mx-auto w-full max-w-[1280px] px-5 py-6 md:px-8 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[840px]">
        <header className="space-y-3">
          <h1 className="font-head text-5xl text-[var(--text-head)]">
            Draft generator
          </h1>
          <p className="text-lg leading-8 text-[var(--text-body)]">
            Describe the administration, tax, or compliance issue. Prepare a professional draft grounded in the reviewed library.
          </p>
        </header>

        <section className="mt-8 q-shell-card p-6">
          {nodeId && nodeTitle && (
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Grounded in {nodeTitle}
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

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            rows={5}
            disabled={loading}
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-5 py-4 text-lg leading-8 text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled(query, loading)}
            className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center rounded-xl bg-[var(--accent-solid)] px-6 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate draft
          </button>

          {wikiSources > 0 && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Your workspace currently contributes {wikiSources} source{wikiSources === 1 ? "" : "s"} to retrieval.
            </p>
          )}

          {emptyHint && (
            <p className="mt-3 text-sm text-[var(--danger)]">
              Provide a drafting prompt before submitting.
            </p>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
              {offline ? (
                <p className="text-sm text-[var(--text-body)]">
                  A connection is required to prepare a draft. Search and reading remain available offline.
                </p>
              ) : (
                <div className="space-y-3">
                  <h2 className="font-head text-2xl text-[var(--text-head)]">
                    The draft could not be prepared
                  </h2>
                  <p className="text-sm text-[var(--text-body)]">
                    The request was not completed. Try again from the same prompt.
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
        </section>

        {!hideExamples && (
        <section className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Try an example
          </p>
          <div className="mt-4 space-y-3">
            {SCENARIOS.slice(0, 3).map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => doSubmit("", scenario.id)}
                className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-5 text-left text-base text-[var(--text-primary)] transition hover:border-[var(--accent)]"
              >
                <span>{scenario.label}</span>
                <span className="text-[var(--accent)]">→</span>
              </button>
            ))}
          </div>
        </section>
        )}
      </div>

      {loading && (
        <section className="mx-auto mt-10 max-w-[1280px] rounded-2xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            {loadingStage === "searching" ? "Searching the library" : "Preparing the draft"}
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
        <div ref={resultRef} className="mt-10 space-y-8">
          {turns.map((turn) => (
            <section key={turn.id} className="space-y-4">
              {turn.result.fallbackUsed && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 text-sm leading-7 text-[var(--text-body)]">
                  The request was aligned to the closest curated scenario available in the library:
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
    </div>
  );
}

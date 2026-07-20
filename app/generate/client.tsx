"use client";

import { useState, useRef } from "react";
import { getNode } from "@/lib/content/tree";
import ScenarioChips from "@/components/ScenarioChips";
import ArtifactResult from "@/components/ArtifactResult";
import {
  DEFAULT_PLACEHOLDER,
  getNodePlaceholder,
  isSubmitDisabled,
} from "@/lib/generate-utils";

type Citation = { nodeId: string; title: string };

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

type Props = {
  initialQuery?: string;
  initialNodeId?: string;
};

export default function GenerateClient({
  initialQuery = "",
  initialNodeId,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [nodeId, setNodeId] = useState<string | undefined>(initialNodeId);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"searching" | "drafting">(
    "searching"
  );
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setResult(null);
    setError(false);
    setOffline(false);

    const timer = setTimeout(() => setLoadingStage("drafting"), 600);

    try {
      const body: Record<string, string> = {};
      if (scenarioId) {
        body.scenarioId = scenarioId;
      } else {
        body.query = submitQuery;
        if (nodeId) body.nodeId = nodeId;
      }

      const res = await fetch("/api/artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      setResult(data);
    } catch {
      const isOff = typeof navigator !== "undefined" && !navigator.onLine;
      setOffline(isOff);
      setError(true);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const handleSubmit = () => doSubmit(query);

  const handleScenarioSelect = (scenarioId: string, label: string) => {
    setQuery(label);
    doSubmit(label, scenarioId);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Node context chip */}
      {nodeId && nodeTitle && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm px-3 py-1 rounded border border-[var(--accent)] text-[var(--accent)]">
            Using: {nodeTitle}
          </span>
          <button
            onClick={() => setNodeId(undefined)}
            aria-label="Remove context"
            className="text-[var(--text-muted)] hover:text-[var(--text-body)] text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={loading}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-body)] px-4 py-3 resize-none focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 placeholder:text-[var(--text-muted)]"
        style={{ fontSize: "16px" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />

      {emptyHint && (
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Please describe what you need help with.
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitDisabled(query, loading)}
        className="mt-3 min-h-[44px] px-6 py-2 rounded bg-[var(--accent-solid)] text-[var(--accent-on)] font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        Generate
      </button>

      {/* Scenario chips */}
      <ScenarioChips onSelect={handleScenarioSelect} disabled={loading} />

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-6">
          <p className="text-sm text-[var(--text-muted)] mb-3">
            {loadingStage === "searching"
              ? "Searching the knowledge base…"
              : "Drafting your answer…"}
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-6">
            <div className="flex gap-3 mb-5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-8 w-20 rounded bg-[var(--surface-2)] animate-pulse"
                />
              ))}
            </div>
            {[80, 70, 60, 50].map((w, i) => (
              <div
                key={i}
                className="h-4 rounded bg-[var(--surface-2)] animate-pulse mb-2"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fallback notice */}
      {result && result.fallbackUsed && (
        <div className="mt-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
          <p className="text-sm text-[var(--text-body)]">
            We couldn&apos;t confidently answer that from our library, so
            here&apos;s the closest curated scenario:{" "}
            <strong>
              {(result.fallbackScenario ?? result.scenario)?.label}
            </strong>
            .
          </p>
          <button
            onClick={() => {
              setResult(null);
              textareaRef.current?.focus();
            }}
            className="text-sm text-[var(--accent)] mt-2 block"
          >
            Try rephrasing
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
          {offline ? (
            <p className="text-sm text-[var(--text-body)]">
              You appear to be offline. Generating an answer needs a connection
              — browsing and search still work.
            </p>
          ) : (
            <>
              <h2 className="font-serif text-xl text-[var(--text-head)] mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-[var(--text-body)] mb-4">
                We couldn&apos;t generate that — your question wasn&apos;t
                lost. Try again.
              </p>
              <button
                onClick={handleSubmit}
                className="min-h-[44px] px-5 py-2 rounded bg-[var(--accent-solid)] text-[var(--accent-on)] text-sm font-medium"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <ArtifactResult
          artifactId={result.artifactId}
          title={result.title}
          bodyMarkdown={result.bodyMarkdown}
          quickShare={result.quickShare}
          citations={result.citations}
        />
      )}
    </div>
  );
}

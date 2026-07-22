"use client";

import { useState, useRef, useEffect } from "react";
import { getNode } from "@/lib/content/tree";
import ArtifactResult from "@/components/ArtifactResult";
import StartHereBanner from "@/components/StartHereBanner";
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

function QuestionBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[var(--text-primary)] text-sm">
        {text}
      </div>
    </div>
  );
}

export default function GenerateClient({
  initialQuery = "",
  initialNodeId,
  showBanner = false,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [nodeId, setNodeId] = useState<string | undefined>(initialNodeId);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"searching" | "drafting">(
    "searching"
  );
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const nodeTitle = nodeId ? getNode(nodeId)?.title : undefined;
  const placeholder = nodeTitle
    ? getNodePlaceholder(nodeTitle)
    : DEFAULT_PLACEHOLDER;

  const hasThread = turns.length > 0 || loading || error;

  useEffect(() => {
    if (hasThread) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns.length, loading, error, hasThread]);

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
    setPendingQuery(submitQuery);
    setLastQuery(submitQuery);
    setQuery("");

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
      setTurns((prev) => [
        ...prev,
        { id: Date.now(), query: submitQuery, result: data },
      ]);
    } catch {
      const isOff = typeof navigator !== "undefined" && !navigator.onLine;
      setOffline(isOff);
      setError(true);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setPendingQuery(null);
    }
  };

  const handleSubmit = () => doSubmit(query);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 flex flex-col min-h-full">
      {/* Thread / empty state */}
      {!hasThread ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
          {showBanner && (
            <div className="w-full max-w-md">
              <StartHereBanner />
            </div>
          )}
          <h1 className="font-head text-heading text-3xl md:text-4xl leading-tight">
            What can I help you explain?
          </h1>
          <p className="mt-3 text-[var(--text-muted)]">
            Ask about any equity-comp topic and I&apos;ll draft a clear,
            share-ready explanation.
          </p>
        </div>
      ) : (
        <div className="flex-1 py-8 space-y-8">
          {turns.map((t) => (
            <div key={t.id} className="space-y-4">
              <QuestionBubble text={t.query} />
              {t.result.fallbackUsed && (
                <div className="p-4 rounded-lg border border-[var(--border)] border-l-2 border-l-[var(--accent-line)] bg-[var(--surface-2)]">
                  <p className="text-sm text-[var(--text-body)]">
                    We couldn&apos;t confidently answer that from our library, so
                    here&apos;s the closest curated scenario:{" "}
                    <strong>
                      {(t.result.fallbackScenario ?? t.result.scenario)?.label}
                    </strong>
                    .
                  </p>
                </div>
              )}
              <ArtifactResult
                artifactId={t.result.artifactId}
                title={t.result.title}
                bodyMarkdown={t.result.bodyMarkdown}
                quickShare={t.result.quickShare}
                citations={t.result.citations}
              />
            </div>
          ))}

          {/* In-flight question + loading skeleton */}
          {loading && (
            <div className="space-y-4">
              {pendingQuery && <QuestionBubble text={pendingQuery} />}
              <div>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  {loadingStage === "searching"
                    ? "Searching the knowledge base…"
                    : "Drafting your answer…"}
                </p>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-6">
                  {[80, 70, 60, 50].map((w, i) => (
                    <div
                      key={i}
                      className="h-4 rounded bg-[var(--surface-2)] animate-pulse mb-2"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-6 rounded-xl border border-[var(--border)] border-l-2 border-l-[var(--danger)] bg-[var(--surface-2)]">
              {offline ? (
                <p className="text-sm text-[var(--text-body)]">
                  You appear to be offline. Generating an answer needs a
                  connection — browsing and search still work.
                </p>
              ) : (
                <>
                  <h2 className="font-head text-xl text-[var(--text-head)] mb-2">
                    Something went wrong
                  </h2>
                  <p className="text-sm text-[var(--text-body)] mb-4">
                    We couldn&apos;t generate that — your question wasn&apos;t
                    lost. Try again.
                  </p>
                  <button
                    onClick={() => doSubmit(lastQuery)}
                    className="min-h-[44px] px-5 py-2 rounded bg-[var(--accent-solid)] text-[var(--accent-on)] text-sm font-medium"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer (pinned to the bottom of the viewport) */}
      <div className="sticky bottom-0 bg-bg pt-2 pb-3">
        {nodeId && nodeTitle && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-3 py-1 rounded-full border border-[var(--accent)] text-[var(--accent)]">
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

        <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] focus-within:border-[var(--accent-line)] transition-colors">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            rows={1}
            disabled={loading}
            className="w-full bg-transparent text-[var(--text-body)] px-4 pt-4 pb-2 resize-none focus:outline-none placeholder:text-[var(--text-muted)]"
            style={{ fontSize: "16px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled(query, loading)}
              aria-label="Generate answer"
              className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{
                width: "44px",
                height: "44px",
                backgroundColor: "var(--accent-solid)",
                color: "var(--accent-on)",
              }}
            >
              ➤
            </button>
          </div>
        </div>

        {emptyHint && (
          <p className="text-sm text-[var(--text-muted)] mt-2 text-center">
            Please describe what you need help with.
          </p>
        )}
      </div>
    </div>
  );
}

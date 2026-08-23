"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArtifactResult from "@/components/ArtifactResult";
import { getNode } from "@/lib/content/tree";
import { isSubmitDisabled } from "@/lib/generate-utils";

type Citation = { kind?: "topic" | "source" | "user-node"; nodeId?: string; sourceId?: string; title: string };
type Format = "reference" | "pdf" | "email" | "comparison";
type ApiResponse = { artifactId: string; title: string; bodyMarkdown: string; quickShare: string; citations: Citation[]; status: string; fallbackUsed: boolean; fallbackScenario?: { id: string; label: string }; scenario: { id: string; label: string } | null; logged: boolean };
type Turn = { id: number; query: string; format: Format; result: ApiResponse };

const commonQuestions = [
  { label: "Award Types", question: "What is the difference between ISOs and NSOs? When would I use one over the other?" },
  { label: "Tax and Withholding", question: "An employee exercised a large ISO grant this year. Could they owe AMT even if they did not sell the shares?" },
  { label: "Equity Lifecycle", question: "An employee was terminated last month. What happens to their unvested RSUs and what is the exercise window for their options?" },
  { label: "Year-end Reporting", question: "What do I need to file at year-end for ISO exercises? Walk me through Forms 3921, 3922 and W-2 adjustments." },
];

const formats: Array<{ id: Format; label: string }> = [
  { id: "reference", label: "Reference guide" },
  { id: "pdf", label: "PDF" },
  { id: "email", label: "Email draft" },
  { id: "comparison", label: "Comparison table" },
];

type Props = { initialQuery?: string; initialNodeId?: string };

export default function GenerateClient({ initialQuery = "", initialNodeId }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [nodeId] = useState<string | undefined>(initialNodeId);
  const [format, setFormat] = useState<Format>("reference");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const autoSubmitted = useRef(false);
  const nodeTitle = nodeId ? getNode(nodeId)?.title : undefined;

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
    if (storageReady) sessionStorage.setItem("equityiq:drafts", JSON.stringify(turns.slice(0, 3)));
  }, [storageReady, turns]);

  useEffect(() => {
    if (turns.length) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [turns.length]);

  const doSubmit = useCallback(async (submitQuery: string) => {
    if (!submitQuery.trim()) {
      setEmptyHint(true);
      return;
    }
    setEmptyHint(false);
    setLoading(true);
    setError(false);
    setOffline(false);
    setLastQuery(submitQuery);
    try {
      const body: Record<string, string> = { query: submitQuery, format };
      if (nodeId) body.nodeId = nodeId;
      const response = await fetch("/api/artifact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as ApiResponse;
      setTurns((current) => [{ id: Date.now(), query: submitQuery, format, result }, ...current]);
    } catch {
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [format, nodeId]);

  useEffect(() => {
    if (!storageReady || !initialQuery.trim() || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void doSubmit(initialQuery);
  }, [doSubmit, initialQuery, storageReady]);

  const reset = () => {
    setTurns([]);
    setError(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="v9-ask-page">
    <section className="v9-ask-hero"><div><h1>What do you need to know?</h1><p>Walk us through what&apos;s going on. We&apos;ll give you a straight answer, not a reading list.</p></div></section>
    <div className="v9-ask-wrap">
      {turns.length === 0 && <>
        <section className="v9-ask-card v9-ask-prompt-card">
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder={nodeTitle ? `Ask about ${nodeTitle}` : "e.g. I need a side-by-side of ISOs vs NSOs for a board meeting. What are the tax differences and when would you use one over the other?"} disabled={loading} className="v9-ask-textarea" aria-label="Your question" />
          {nodeTitle && <p className="v9-topic-context">Knowledge Tree topic: {nodeTitle}</p>}
          <div className="v9-format-row" aria-label="Answer format">{formats.map((item) => <button key={item.id} type="button" className={format === item.id ? "is-active" : ""} onClick={() => setFormat(item.id)}>{item.label}</button>)}</div>
          <button type="button" onClick={() => void doSubmit(query)} disabled={isSubmitDisabled(query, loading)} className="v9-primary-button v9-get-answer">{loading ? "Getting your answer" : "Get my answer"}<span aria-hidden="true">→</span></button>
          {emptyHint && <p className="v9-form-error">Write a question to get started.</p>}
          {error && <div className="v9-request-error">{offline ? "A connection is required to get an answer." : "The request did not complete. Try again."}<button type="button" onClick={() => void doSubmit(lastQuery)}>Try again</button></div>}
        </section>
        <section className="v9-common-questions"><h2>Common questions</h2><div className="v9-common-grid">{commonQuestions.map((item) => <button key={item.label} type="button" onClick={() => { setQuery(item.question); void doSubmit(item.question); }}><span>{item.label}</span><strong>{item.question}</strong><b aria-hidden="true">→</b></button>)}</div></section>
      </>}
      {loading && <section className="v9-loading-card"><p>Searching the knowledge base</p><div className="v9-loading-lines">{[92, 78, 88, 64].map((width) => <i key={width} style={{ width: `${width}%` }} />)}</div></section>}
      {turns.length > 0 && <div ref={resultRef} className="v9-result-stack"><button type="button" className="v9-try-again" onClick={reset}>← Try again</button>{turns.map((turn) => <section key={turn.id} className="v9-result-turn"><div className="v9-result-request"><span>{formats.find((item) => item.id === turn.format)?.label ?? "Reference guide"}</span><p>{turn.query}</p></div>{turn.result.fallbackUsed && <p className="v9-fallback">This question is closest to <strong>{(turn.result.fallbackScenario ?? turn.result.scenario)?.label}</strong>.</p>}<ArtifactResult artifactId={turn.result.artifactId} title={turn.result.title} bodyMarkdown={turn.result.bodyMarkdown} quickShare={turn.result.quickShare} citations={turn.result.citations} /></section>)}</div>}
    </div>
  </div>;
}

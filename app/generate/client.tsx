"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ArtifactResult from "@/components/ArtifactResult";
import ComparisonResult from "@/components/ComparisonResult";
import PreparingAnswer from "@/components/generate/PreparingAnswer";
import { useAuth } from "@/components/auth/AuthProvider";
import { getNode } from "@/lib/content/tree";
import { downloadArtifactPdf, deliverArtifactEmail } from "@/lib/artifact/delivery-client";
import { canDeliverGeneratedAnswer, isSubmitDisabled } from "@/lib/generate-utils";
import { PRESET_ANSWERS, type PresetAnswer } from "@/lib/generate/preset-answers";
import type { ComparisonData } from "@/lib/llm/types";

type Citation = { kind?: "topic" | "source" | "user-node"; nodeId?: string; sourceId?: string; title: string };
type Format = "reference" | "pdf" | "email" | "comparison";
type AnswerUnavailableReason = "content-gap" | "off-topic" | "comparison-refinement" | "technical-failure";
type ApiResponse = { artifactId: string; title: string; bodyMarkdown: string; quickShare: string; citations: Citation[]; comparison?: ComparisonData; status: string; answerAvailable?: boolean; answerUnavailableReason?: AnswerUnavailableReason; fallbackUsed: boolean; fallbackScenario?: { id: string; label: string }; scenario: { id: string; label: string } | null; logged: boolean };
type Turn = { id: number; query: string; format: Format; result: ApiResponse };
type DeliveryState = { kind: "pdf" | "email"; state: "working" | "success" | "error"; recipient?: string } | null;
type PendingEmailIntent = { query: string; recipient: string; nodeId?: string; format: "email"; createdAt: number };

const PENDING_EMAIL_KEY = "equityiq:pending-email-intent:v1";
const STORAGE_KEY = "equityiq:drafts:v2";
const formats: Array<{ id: Exclude<Format, "reference">; label: string; description: string }> = [
  { id: "pdf", label: "PDF", description: "Show the answer and download a copy." },
  { id: "email", label: "Email", description: "Show the answer and send it by email." },
  { id: "comparison", label: "Comparison table", description: "Show a side-by-side answer." },
];
const submitLabels: Record<Format, string> = { reference: "Get my answer", pdf: "Generate and download", email: "Generate and send", comparison: "Generate comparison" };
type Props = { initialQuery?: string; initialNodeId?: string };

function readPendingEmailIntent(): PendingEmailIntent | null {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "null") as PendingEmailIntent | null;
    if (!pending || Date.now() - pending.createdAt > 10 * 60_000) { sessionStorage.removeItem(PENDING_EMAIL_KEY); return null; }
    return pending;
  } catch { sessionStorage.removeItem(PENDING_EMAIL_KEY); return null; }
}

export default function GenerateClient({ initialQuery = "", initialNodeId }: Props) {
  const { user, emailMode, emailConfigured } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [nodeId] = useState<string | undefined>(initialNodeId);
  // Reference remains the API's ordinary on-screen mode, but is intentionally
  // not exposed as a format choice in the compact question box.
  const [format, setFormat] = useState<Format>("reference");
  const [recipient, setRecipient] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [loading, setLoading] = useState(Boolean(initialQuery.trim()));
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [lastFormat, setLastFormat] = useState<Format>("reference");
  const [delivery, setDelivery] = useState<DeliveryState>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const autoSubmitted = useRef(false);
  const pendingConsumed = useRef(false);
  const pendingPresetDelay = useRef<{ timer: number; resolve: () => void } | null>(null);
  // A new request cancels the previous one. The sequence number also protects
  // the screen if an older network response reaches the browser after a newer one.
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const nodeTitle = nodeId ? getNode(nodeId)?.title : undefined;

  const cancelPresetDelay = useCallback(() => {
    const pending = pendingPresetDelay.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingPresetDelay.current = null;
    pending.resolve();
  }, []);

  const waitForPresetDelay = useCallback(() => new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      pendingPresetDelay.current = null;
      resolve();
    }, 2_500);
    pendingPresetDelay.current = { timer, resolve };
  }), []);

  useEffect(() => { sessionStorage.removeItem(STORAGE_KEY); }, []);
  useEffect(() => { if (turn) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [turn]);

  // Automatic delivery and the post-result Actions card use the same client
  // helpers so retries can reuse this answer instead of generating another one.
  const runDelivery = useCallback(async (result: ApiResponse, selectedFormat: Format, selectedRecipient?: string, question?: string) => {
    if (selectedFormat === "pdf") {
      setDelivery({ kind: "pdf", state: "working" });
      try { await downloadArtifactPdf({ ...result, question }); setDelivery({ kind: "pdf", state: "success" }); }
      catch { setDelivery({ kind: "pdf", state: "error" }); }
      return;
    }
    if (selectedFormat === "email") {
      setDelivery({ kind: "email", state: "working" });
      try { const output = await deliverArtifactEmail({ ...result, question }, selectedRecipient); setDelivery({ kind: "email", state: "success", recipient: output.recipientMasked || selectedRecipient }); }
      catch { setDelivery({ kind: "email", state: "error", recipient: selectedRecipient }); }
    }
  }, []);

  const doSubmit = useCallback(async (submitQuery: string, submitFormat: Format = format, submitRecipient = recipient, submitNodeId = nodeId) => {
    if (!submitQuery.trim()) { setEmptyHint(true); return; }
    if (submitFormat === "email" && emailMode === "production" && !submitRecipient.trim()) { setEmptyHint(false); setError(true); setLastQuery(submitQuery); setLastFormat(submitFormat); return; }
    cancelPresetDelay();
    activeRequest.current?.abort();
    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    setEmptyHint(false); setTurn(null); setDelivery(null); setLoading(true); setError(false); setOffline(false); setLastQuery(submitQuery); setLastFormat(submitFormat);
    try {
      const body: Record<string, string> = { query: submitQuery, format: submitFormat };
      if (submitNodeId) body.nodeId = submitNodeId;
      const response = await fetch("/api/artifact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as ApiResponse;
      if (requestId !== requestSequence.current) return;
      setTurn({ id: Date.now(), query: submitQuery, format: submitFormat, result });
      if (canDeliverGeneratedAnswer(result.answerAvailable)) {
        await runDelivery(result, submitFormat, submitRecipient, submitQuery);
      }
    } catch (requestError) {
      if (requestId !== requestSequence.current || (requestError instanceof DOMException && requestError.name === "AbortError")) return;
      setOffline(typeof navigator !== "undefined" && !navigator.onLine); setError(true);
    } finally { if (requestId === requestSequence.current) { activeRequest.current = null; setLoading(false); } }
  }, [cancelPresetDelay, emailMode, format, nodeId, recipient, runDelivery]);

  const doPresetSubmit = useCallback(async (preset: PresetAnswer) => {
    cancelPresetDelay();
    activeRequest.current?.abort();
    const requestId = ++requestSequence.current;
    activeRequest.current = null;
    setQuery(preset.question);
    setFormat("reference");
    setEmptyHint(false); setTurn(null); setDelivery(null); setLoading(true); setError(false); setOffline(false); setLastQuery(preset.question); setLastFormat("reference");

    await waitForPresetDelay();
    if (requestId !== requestSequence.current) return;

    const uniquePart = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setTurn({
      id: Date.now(),
      query: preset.question,
      format: "reference",
      result: {
        artifactId: `preset-${preset.id}-${uniquePart}`,
        title: preset.title,
        bodyMarkdown: preset.bodyMarkdown,
        quickShare: preset.quickShare,
        citations: [...preset.citations],
        status: "ok",
        answerAvailable: true,
        fallbackUsed: false,
        scenario: null,
        logged: false,
      },
    });
    setLoading(false);
  }, [cancelPresetDelay, waitForPresetDelay]);

  const requestSubmit = useCallback(() => {
    if (format === "email" && !user) {
      if (emailMode === "production" && !recipient.trim()) { setError(true); return; }
      sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ query, recipient, nodeId, format: "email", createdAt: Date.now() } satisfies PendingEmailIntent));
      window.dispatchEvent(new Event("equityiq:open-sign-in")); return;
    }
    void doSubmit(query);
  }, [doSubmit, emailMode, format, nodeId, query, recipient, user]);

  useEffect(() => () => { cancelPresetDelay(); activeRequest.current?.abort(); requestSequence.current += 1; }, [cancelPresetDelay]);
  useEffect(() => {
    const cancelPendingIntent = () => sessionStorage.removeItem(PENDING_EMAIL_KEY);
    window.addEventListener("equityiq:sign-in-cancelled", cancelPendingIntent);
    return () => window.removeEventListener("equityiq:sign-in-cancelled", cancelPendingIntent);
  }, []);
  useEffect(() => { if (!initialQuery.trim() || autoSubmitted.current) return; autoSubmitted.current = true; void doSubmit(initialQuery); }, [doSubmit, initialQuery]);
  useEffect(() => {
    if (!user || pendingConsumed.current) return;
    const pending = readPendingEmailIntent(); if (!pending) return;
    pendingConsumed.current = true; sessionStorage.removeItem(PENDING_EMAIL_KEY); setQuery(pending.query); setRecipient(pending.recipient); setFormat("email"); void doSubmit(pending.query, "email", pending.recipient, pending.nodeId);
  }, [doSubmit, user]);

  const reset = () => { cancelPresetDelay(); activeRequest.current?.abort(); requestSequence.current += 1; sessionStorage.removeItem(PENDING_EMAIL_KEY); setTurn(null); setDelivery(null); setLoading(false); setError(false); setOffline(false); setRecipient(""); setFormat("reference"); setQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const refineQuestion = () => {
    cancelPresetDelay(); activeRequest.current?.abort(); requestSequence.current += 1; setTurn(null); setDelivery(null); setLoading(false); setError(false); setOffline(false); setFormat("reference");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => questionRef.current?.focus(), 250);
  };
  const retryDelivery = () => { if (turn && delivery) void runDelivery(turn.result, delivery.kind, delivery.recipient || recipient, turn.query); };
  const missingRecipient = format === "email" && emailMode === "production" && !recipient.trim();
  const deliveryMessage = delivery?.state === "success" ? delivery.kind === "pdf" ? "PDF downloaded" : `Email sent to ${delivery.recipient || "the selected recipient"}` : delivery?.state === "error" ? delivery.kind === "pdf" ? "PDF could not be created" : "Email could not be sent" : delivery?.state === "working" ? delivery.kind === "pdf" ? "Preparing PDF" : "Sending email" : null;

  return <div className="v9-ask-page">
    <section className="v9-ask-hero"><div><h1>What do you need to know?</h1><p>Walk us through what&apos;s going on. We&apos;ll give you a straight answer, not a reading list.</p></div></section>
    <div className="v9-ask-wrap">
      {!turn && !loading && <>
        <section className="v9-ask-card v9-ask-prompt-card">
          <textarea ref={questionRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={nodeTitle ? `Ask about ${nodeTitle}` : "e.g. I need a side-by-side of ISOs vs NSOs for a board meeting. What are the tax differences and when would you use one over the other?"} className="v9-ask-textarea" aria-label="Your question" />
          {nodeTitle && <p className="v9-topic-context">Knowledge Tree topic: {nodeTitle}</p>}
          <div className="v9-format-cards" aria-label="Optional output format">
            {formats.map((item) => <button key={item.id} type="button" aria-pressed={format === item.id} className={format === item.id ? "is-active" : ""} onClick={() => { const nextFormat = format === item.id ? "reference" : item.id; setFormat(nextFormat); setError(false); if (nextFormat !== "email") sessionStorage.removeItem(PENDING_EMAIL_KEY); }}><strong>{item.label}</strong><span>{item.description}</span></button>)}
          </div>
          {format === "email" && <div className="v9-email-choice">{emailMode === "production" ? <input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="name@company.com" aria-label="Recipient email" /> : <p>{emailConfigured ? "Demo mode sends to the configured test inbox." : "Email delivery is not configured in this environment."}</p>}</div>}
          <button type="button" onClick={requestSubmit} disabled={isSubmitDisabled(query, loading)} className="v9-primary-button v9-get-answer">{submitLabels[format]}<span aria-hidden="true">→</span></button>
          {emptyHint && <p className="v9-form-error">Write a question to get started.</p>}
          {error && <div className="v9-request-error" role="alert">
            {missingRecipient ? <span>Enter a recipient email address before sending.</span> : offline ? <span>A connection is required to get an answer.</span> : <span><strong>We could not prepare your answer.</strong> Something went wrong while preparing the answer. Please try again in a moment.</span>}
            {!missingRecipient && <button type="button" onClick={() => void doSubmit(lastQuery || query, lastFormat || format, recipient)}>Try again</button>}
          </div>}
        </section>
        <section className="v9-common-questions"><h2>Common questions</h2><div className="v9-common-grid">{PRESET_ANSWERS.map((item) => <button key={item.id} type="button" onClick={() => void doPresetSubmit(item)}><span>{item.label}</span><strong>{item.question}</strong><b aria-hidden="true">→</b></button>)}</div></section>
      </>}
      {loading && <PreparingAnswer />}
      {turn && <div ref={resultRef} className="v9-result-stack">
        <section className="v9-result-toolbar"><div><span>{canDeliverGeneratedAnswer(turn.result.answerAvailable) && (turn.format !== "comparison" || turn.result.comparison) ? "Your Question" : "We couldn't answer this yet"}</span><p>{turn.query}</p>{deliveryMessage && <small className={delivery?.state === "error" ? "is-error" : ""}>{deliveryMessage}{delivery?.state === "error" && <button type="button" onClick={retryDelivery}>Retry {delivery.kind === "pdf" ? "download" : "sending"}</button>}</small>}</div><button type="button" className="v9-ask-another" onClick={reset}>Ask another question</button></section>
        {canDeliverGeneratedAnswer(turn.result.answerAvailable) && (turn.format !== "comparison" || turn.result.comparison) ? <>
          {turn.result.fallbackUsed && (turn.result.fallbackScenario ?? turn.result.scenario)?.label && <p className="v9-fallback">This question is closest to <strong>{(turn.result.fallbackScenario ?? turn.result.scenario)?.label}</strong>.</p>}
          {turn.format === "comparison" && turn.result.comparison ? <ComparisonResult comparison={turn.result.comparison} /> : <ArtifactResult artifactId={turn.result.artifactId} title={turn.result.title} question={turn.query} bodyMarkdown={turn.result.bodyMarkdown} quickShare={turn.result.quickShare} citations={turn.result.citations} comparison={turn.result.comparison} />}
        </> : <section className="v9-no-answer" role="status">
          <span className="v9-no-answer-icon" aria-hidden="true">?</span><p className="v9-no-answer-eyebrow">More context needed</p><h2>{turn.result.answerUnavailableReason === "off-topic" ? "This question is outside EquityIQ's current scope" : turn.result.answerUnavailableReason === "comparison-refinement" ? "We could not build a reliable comparison" : "We do not have enough verified guidance yet"}</h2>
          <p>{turn.result.bodyMarkdown}</p>
          <div><button type="button" className="v9-primary-button" onClick={refineQuestion}>Refine this question</button><Link href="/browse">Browse the Knowledge Tree</Link></div>
        </section>}
      </div>}
    </div>
  </div>;
}

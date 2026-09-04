"use client";

import { useEffect, useRef, useState } from "react";
import { buildArtifactCopyText, getCopyLabel } from "@/lib/generate-utils";
import { getNode } from "@/lib/content/tree";
import { useAuth } from "@/components/auth/AuthProvider";
import { deliverArtifactEmail, downloadArtifactPdf } from "@/lib/artifact/delivery-client";
import type { ComparisonData } from "@/lib/llm/types";

type Citation = {
  kind?: "topic" | "source" | "user-node";
  nodeId?: string;
  sourceId?: string;
  title: string;
};

type Props = {
  artifactId: string;
  title: string;
  question: string;
  bodyMarkdown: string;
  quickShare: string;
  citations: Citation[];
  comparison?: ComparisonData;
};

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

/**
 * The answer renderer intentionally supports a small Markdown subset rather
 * than injecting generated HTML. That keeps links, lists, and emphasis useful
 * without letting provider output control the page structure.
 */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={index}
          className="v9-answer-heading mt-8 text-2xl font-semibold text-[var(--text-head)]"
        >
          {line.slice(3)}
        </h2>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={index}
          className="v9-answer-heading mt-8 text-3xl font-semibold text-[var(--text-head)]"
        >
          {line.slice(2)}
        </h1>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2));
        index += 1;
      }
      elements.push(
        <ul
          key={`ul-${index}`}
          className="v9-answer-list ml-5 list-disc space-y-2 text-[var(--text-body)]"
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s*/, ""));
        index += 1;
      }
      elements.push(
        <ol
          key={`ol-${index}`}
          className="v9-answer-list ml-5 list-decimal space-y-2 text-[var(--text-body)]"
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={index} className="v9-answer-paragraph text-base leading-8 text-[var(--text-body)]">
        {renderInline(line)}
      </p>
    );
    index += 1;
  }

  return <div className="v9-answer-markdown space-y-4">{elements}</div>;
}

function SectionCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`v9-section-card rounded-2xl border border-[var(--border)] bg-white p-5 ${className ?? ""}`}>
      <h3 className="v9-section-card-title text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {title}
      </h3>
      {description ? (
        <p className="v9-section-card-description mt-2 text-sm leading-6 text-[var(--text-body)]">{description}</p>
      ) : null}
      <div className="v9-section-card-body mt-4">{children}</div>
    </section>
  );
}

export default function ArtifactResult({
  artifactId,
  title,
  question,
  bodyMarkdown,
  citations,
  comparison,
}: Props) {
  const { user, emailMode, testRecipientMasked } = useAuth();
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [emailSubmittedTo, setEmailSubmittedTo] = useState("");
  const [emailError, setEmailError] = useState("");
  const quickShareRef = useRef<HTMLPreElement>(null);
  const copyText = buildArtifactCopyText(question, bodyMarkdown);

  const topicCitations = citations.filter((citation) => {
    if (citation.kind === "source" || citation.kind === "user-node" || !citation.nodeId) return false;
    const node = getNode(citation.nodeId);
    return Boolean(node && node.contentState !== "planned");
  });
  const sourceCitations = citations.filter((citation) => citation.kind === "source" || citation.kind === "user-node");
  const primaryTopic = topicCitations
    .map((citation) => citation.nodeId ? getNode(citation.nodeId) : undefined)
    .find((node): node is NonNullable<typeof node> => Boolean(node));
  const browseHref = primaryTopic ? `/p/${primaryTopic.pillarSlug}` : "/browse";

  useEffect(() => {
    if (!user) return;
    const pendingArtifact = sessionStorage.getItem("equityiq:pending-email");
    if (pendingArtifact === artifactId) {
      sessionStorage.removeItem("equityiq:pending-email");
      setShowEmail(true);
    }
  }, [artifactId, user]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (quickShareRef.current) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(quickShareRef.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  };

  const handleOpenPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadArtifactPdf({ artifactId, title, question, bodyMarkdown, citations, comparison });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailStatus("sending");
    setEmailError("");
    try {
      const result = await deliverArtifactEmail({ artifactId, title, question, bodyMarkdown, citations, comparison }, email);
      setEmailSubmittedTo(result.recipientMasked || email);
      setEmailStatus("success");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "email_delivery_failed";
      setEmailError(
        reason === "recipient_required"
          ? "Enter a recipient email address before sending."
          : reason === "email_not_configured"
          ? "Email is not configured yet. Add the Resend values and try again."
          : "The email could not be sent. Check the connection and try again."
      );
      setEmailStatus("error");
    }
  };

  const handleEmailOpen = () => {
    if (!user) {
      sessionStorage.setItem("equityiq:pending-email", artifactId);
      window.dispatchEvent(new Event("equityiq:open-sign-in"));
      return;
    }
    setShowEmail((value) => !value);
  };

  const actionButton =
    "v9-action-button inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-2)]";

  return (
    <div className="v9-artifact-layout">
      <section className="v9-artifact-document">
        <div className="v9-artifact-header">
          <div className="v9-artifact-question">
            <p>{question}</p>
          </div>
        </div>
        <div className="v9-artifact-body">
          <SimpleMarkdown text={bodyMarkdown} />
        </div>
      </section>

      <aside className="v9-artifact-aside">
        <SectionCard
          title="Related topics"
          description="Review the guidance behind this answer or start a more focused draft from one of these topics."
          className="v9-related-topics-card"
        >
          {topicCitations.length > 0 ? (
            <div className="v9-related-topic-chips flex flex-wrap gap-2">
              {topicCitations.map((citation, index) => {
                const node = citation.nodeId ? getNode(citation.nodeId) : undefined;
                if (!node) return null;
                return (
                  <a
                    key={`${citation.title}-${index}`}
                    href={`/a/${node.pillarSlug}/${node.slug}`}
                    className="v9-related-topic-chip rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--accent)]"
                    style={{ textDecoration: "none" }}
                  >
                    {citation.title}
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="v9-related-topics-empty">Browse the Knowledge Tree to explore the guidance connected to this answer.</p>
          )}
          <a
            href={browseHref}
            className="v9-browse-related mt-4 inline-flex text-sm font-semibold text-[var(--accent)]"
            style={{ textDecoration: "none" }}
          >
            {topicCitations.length > 0 ? "Browse related topics" : "Browse the Knowledge Tree"}
          </a>
        </SectionCard>

        {sourceCitations.length > 0 && (
          <SectionCard
            title="Supporting sources"
            description="These references supported the draft or were brought in from your workspace."
            className="v9-supporting-sources-card"
          >
            <div className="v9-supporting-source-chips flex flex-wrap gap-2">
              {sourceCitations.map((citation, index) => (
                <a
                  key={`${citation.title}-${index}`}
                  href={`/brain?focus=${encodeURIComponent(
                    citation.sourceId ?? citation.nodeId ?? ""
                  )}`}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  style={{ textDecoration: "none" }}
                >
                  {citation.title}
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Actions" className="v9-actions-card">
          <div className="v9-actions-row flex flex-wrap gap-3">
            <button
              onClick={handleCopy}
              aria-live="polite"
              className={`${actionButton} ${
                copied ? "bg-[var(--accent-solid)] text-white" : ""
              }`}
            >
              {getCopyLabel(copied)}
            </button>
            <button onClick={handleOpenPdf} disabled={pdfLoading} className={actionButton}>
              {pdfLoading ? "Preparing PDF" : "PDF"}
            </button>
            <button onClick={handleEmailOpen} className={actionButton}>
              Email
            </button>
          </div>
          {showEmail && (
            <div className="mt-4">
              {emailStatus === "success" ? (
                <p className="text-sm leading-6 text-[var(--text-body)]">
                  Email sent to {emailSubmittedTo} with the PDF attached.
                </p>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  {emailMode === "production" ? (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text-body)]"
                    />
                  ) : (
                    <p className="rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm leading-6 text-[var(--text-body)]">
                      Demo mode sends to {testRecipientMasked || "the configured Resend inbox"}.
                    </p>
                  )}
                  {emailStatus === "error" && (
                    <p className="text-sm leading-6 text-[var(--danger)]">{emailError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={emailStatus === "sending"}
                    className="inline-flex min-h-[46px] items-center rounded-xl bg-[var(--accent-solid)] px-4 text-sm font-semibold text-white"
                  >
                    {emailStatus === "sending"
                      ? "Sending email"
                      : emailMode === "test"
                        ? "Send demo email"
                        : "Send email"}
                  </button>
                </form>
              )}
            </div>
          )}
        </SectionCard>

        <pre ref={quickShareRef} className="sr-only" aria-hidden="true">
          {copyText}
        </pre>

      </aside>
    </div>
  );
}

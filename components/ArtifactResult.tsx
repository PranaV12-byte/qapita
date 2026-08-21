"use client";

import { useEffect, useRef, useState } from "react";
import { getCopyLabel } from "@/lib/generate-utils";
import { getNode } from "@/lib/content/tree";
import { useAuth } from "@/components/auth/AuthProvider";

type Citation = {
  kind?: "topic" | "source" | "user-node";
  nodeId?: string;
  sourceId?: string;
  title: string;
};

type Props = {
  artifactId: string;
  title: string;
  bodyMarkdown: string;
  quickShare: string;
  citations: Citation[];
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
          className="mt-8 text-2xl font-semibold text-[var(--text-head)]"
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
          className="mt-8 text-3xl font-semibold text-[var(--text-head)]"
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
          className="ml-5 list-disc space-y-2 text-[var(--text-body)]"
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
          className="ml-5 list-decimal space-y-2 text-[var(--text-body)]"
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={index} className="text-base leading-8 text-[var(--text-body)]">
        {renderInline(line)}
      </p>
    );
    index += 1;
  }

  return <div className="space-y-4">{elements}</div>;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ArtifactResult({
  artifactId,
  title,
  bodyMarkdown,
  quickShare,
  citations,
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

  const topicCitations = citations.filter((citation) => {
    if (citation.kind === "source" || citation.kind === "user-node" || !citation.nodeId) return false;
    const node = getNode(citation.nodeId);
    return Boolean(node && node.contentState !== "planned");
  });
  const sourceCitations = citations.filter((citation) => citation.kind === "source" || citation.kind === "user-node");

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
      await navigator.clipboard.writeText(quickShare);
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
      const res = await fetch("/api/artifact/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, bodyMarkdown, citations }),
      });
      if (!res.ok) throw new Error("pdf_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailStatus("sending");
    setEmailError("");
    try {
      const response = await fetch("/api/artifact/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactId,
          channel: "email",
          email: email || undefined,
          title,
          bodyMarkdown,
          citations,
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        recipientMasked?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "email_delivery_failed");
      setEmailSubmittedTo(result.recipientMasked || email);
      setEmailStatus("success");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "email_delivery_failed";
      setEmailError(
        reason === "email_not_configured"
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
    "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-2)]";

  return (
    <div className="v9-artifact-layout">
      <section className="v9-artifact-document">
        <div className="v9-artifact-header">
          <p>Your answer is ready</p>
          <h2 className="mt-3 font-head text-4xl text-[var(--text-head)]">
            {title}
          </h2>
        </div>
        <div className="v9-artifact-body">
          <SimpleMarkdown text={bodyMarkdown} />
        </div>
      </section>

      <aside className="v9-artifact-aside">
        {topicCitations.length > 0 && (
          <SectionCard
            title="Related topics"
            description="Review the guidance behind this communication or start a more focused draft from one of these topics."
          >
            <div className="flex flex-wrap gap-2">
              {topicCitations.map((citation, index) => {
                const node = citation.nodeId ? getNode(citation.nodeId) : undefined;
                const href = node ? `/a/${node.pillarSlug}/${node.slug}` : "#";
                return (
                  <a
                    key={`${citation.title}-${index}`}
                    href={href}
                    className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--accent)]"
                    style={{ textDecoration: "none" }}
                  >
                    {citation.title}
                  </a>
                );
              })}
            </div>
            <a
              href={topicCitations[0]?.nodeId ? `/a/${getNode(topicCitations[0].nodeId!)?.pillarSlug}/${getNode(topicCitations[0].nodeId!)?.slug}` : "/browse"}
              className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)]"
              style={{ textDecoration: "none" }}
            >
              Browse related topics
            </a>
          </SectionCard>
        )}

        {sourceCitations.length > 0 && (
          <SectionCard
            title="Supporting sources"
            description="These references supported the draft or were brought in from your workspace."
          >
            <div className="flex flex-wrap gap-2">
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

        <SectionCard title="Actions">
          <div className="flex flex-wrap gap-3">
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
          {quickShare}
        </pre>

      </aside>
    </div>
  );
}

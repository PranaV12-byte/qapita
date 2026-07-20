"use client";

import { useState, useRef } from "react";
import { getNode } from "@/lib/content/tree";
import { getCopyLabel } from "@/lib/generate-utils";

type Citation = { nodeId: string; title: string };

type Props = {
  artifactId: string;
  title: string;
  bodyMarkdown: string;
  quickShare: string;
  citations: Citation[];
};

// ── Inline markdown renderer ──────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-base font-semibold text-[var(--text-head)] mt-4 mb-1"
        >
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="text-lg font-semibold text-[var(--text-head)] mt-4 mb-1"
        >
          {line.slice(2)}
        </h1>
      );
      i++;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul
          key={`ul-${i}`}
          className="list-disc list-inside text-[var(--text-body)] mb-2 space-y-0.5"
        >
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s*/, ""));
        i++;
      }
      elements.push(
        <ol
          key={`ol-${i}`}
          className="list-decimal list-inside text-[var(--text-body)] mb-2 space-y-0.5"
        >
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={i} className="text-[var(--text-body)] mb-2">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div>{elements}</div>;
}

// ── ArtifactResult (text-first, actions underneath) ─────────────────────────────

export default function ArtifactResult({
  artifactId,
  title,
  bodyMarkdown,
  quickShare,
  citations,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "success">("idle");
  const [emailSubmittedTo, setEmailSubmittedTo] = useState("");
  const quickShareRef = useRef<HTMLPreElement>(null);

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
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/artifact/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId, channel: "email", email }),
      });
      setEmailSubmittedTo(email);
      setEmailStatus("success");
    } catch {
      // ignore delivery errors silently
    }
  };

  const actionBtn =
    "inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-[var(--border)] text-sm text-[var(--text-body)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors";

  return (
    <div>
      {/* Answer text — the primary content */}
      <SimpleMarkdown text={bodyMarkdown} />

      {/* Hidden source for the clipboard selection fallback */}
      <pre ref={quickShareRef} className="sr-only" aria-hidden="true">
        {quickShare}
      </pre>

      {/* Sources — directly under the text */}
      {citations.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-[var(--text-muted)] mb-2">Sources</p>
          <div className="flex flex-wrap gap-2">
            {citations.map((c) => {
              const node = getNode(c.nodeId);
              const href = node ? `/a/${node.pillarSlug}/${node.slug}` : "#";
              return (
                <a
                  key={c.nodeId}
                  href={href}
                  className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                >
                  {c.title}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions — at the bottom of the answer */}
      <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
        <button
          onClick={handleCopy}
          aria-live="polite"
          className={
            actionBtn +
            (copied ? " !text-[var(--accent)] !border-[var(--accent)]" : "")
          }
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {getCopyLabel(copied)}
        </button>
        <button onClick={handleOpenPdf} disabled={pdfLoading} className={actionBtn}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" />
            <path d="m9 15 3 3 3-3" />
          </svg>
          {pdfLoading ? "Preparing…" : "PDF"}
        </button>
        <button onClick={() => setShowEmail((v) => !v)} className={actionBtn}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          Email
        </button>
      </div>

      {/* Email action (revealed) */}
      {showEmail && (
        <div className="mt-3">
          {emailStatus === "success" ? (
            <p className="text-sm text-[var(--text-body)]">
              Request logged — no email sent. Email delivery isn&apos;t enabled
              in this preview build. We&apos;ve recorded that you wanted this
              sent to {emailSubmittedTo}.
            </p>
          ) : (
            <form
              onSubmit={handleEmailSubmit}
              className="flex gap-2 flex-wrap items-start"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 min-w-[200px] min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-body)] px-3"
                style={{ fontSize: "16px" }}
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-on)] text-sm font-medium"
              >
                Log email request
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

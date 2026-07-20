"use client";

import { useState, useRef } from "react";
import { getNode } from "@/lib/content/tree";
import { getCopyLabel } from "@/lib/generate-utils";

type Citation = { nodeId: string; title: string };
type Tab = "text" | "pdf" | "quick-share";

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

// ── ArtifactResult ────────────────────────────────────────────────────────────

export default function ArtifactResult({
  artifactId,
  title,
  bodyMarkdown,
  quickShare,
  citations,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("text");
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "success">("idle");
  const [emailSubmittedTo, setEmailSubmittedTo] = useState("");
  const quickShareRef = useRef<HTMLPreElement>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "text", label: "Text" },
    { id: "pdf", label: "PDF" },
    { id: "quick-share", label: "Quick-share" },
  ];

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

  return (
    <div
      className="border border-[var(--border)] bg-[var(--surface-1)] mt-6"
      style={{ borderRadius: "12px" }}
    >
      {/* Tab bar */}
      <div
        className="flex border-b border-[var(--border)]"
        role="tablist"
        style={{ borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[44px] px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                : "text-[var(--text-muted)] hover:text-[var(--text-body)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === "text" && (
          <div>
            <SimpleMarkdown text={bodyMarkdown} />
            {citations.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Based on
                </p>
                <div className="flex flex-wrap gap-2">
                  {citations.map((c) => {
                    const node = getNode(c.nodeId);
                    const href = node
                      ? `/a/${node.pillarSlug}/${node.slug}`
                      : "#";
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
          </div>
        )}

        {activeTab === "pdf" && (
          <div>
            <p className="text-sm text-[var(--text-body)] mb-4">
              Download a draft PDF of this reference.
            </p>
            <button
              onClick={handleOpenPdf}
              disabled={pdfLoading}
              className="min-h-[44px] px-6 py-2 rounded bg-[var(--accent-solid)] text-[var(--accent-on)] font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {pdfLoading ? "Preparing PDF…" : "Open PDF"}
            </button>
          </div>
        )}

        {activeTab === "quick-share" && (
          <div>
            <pre
              ref={quickShareRef}
              className="whitespace-pre-wrap text-sm text-[var(--text-body)] mb-4 font-sans"
            >
              {quickShare}
            </pre>
            <button
              onClick={handleCopy}
              aria-live="polite"
              className="min-h-[44px] px-4 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-body)] hover:border-[var(--accent)] transition-colors"
            >
              {getCopyLabel(copied)}
            </button>
          </div>
        )}
      </div>

      {/* Email action */}
      <div className="px-6 pb-5">
        <div className="border-t border-[var(--border)] pt-4">
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="min-h-[44px] text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
            >
              Email this
            </button>
          ) : emailStatus === "success" ? (
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
                className="flex-1 min-w-[200px] min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-body)] px-3"
                style={{ fontSize: "16px" }}
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded bg-[var(--accent-solid)] text-[var(--accent-on)] text-sm font-medium"
              >
                Log email request
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

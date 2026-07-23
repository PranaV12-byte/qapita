"use client";

import React from "react";

// Element-based markdown renderer for the note pane (SPEC-VAULT V3). Grows
// ArtifactResult's SimpleMarkdown with h1–h3, lists, blockquotes, inline code,
// simple pipe tables, and `[[wiki-link]]` → in-app navigation. NEVER injects raw
// HTML (no dangerouslySetInnerHTML) — every node is a real React element.

type Props = {
  markdown: string;
  /** Whether a `[[Title]]` resolves to a real note (→ render as a link). */
  linkResolvable: (title: string) => boolean;
  /** Navigate to the note a `[[Title]]` points at. */
  onWikiLink: (title: string) => void;
};

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g;

function Inline({
  text,
  linkResolvable,
  onWikiLink,
}: {
  text: string;
  linkResolvable: (t: string) => boolean;
  onWikiLink: (t: string) => void;
}) {
  const parts = text.split(INLINE_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="text-[var(--text-primary)]">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-[0.85em] text-[var(--accent)]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("[[") && part.endsWith("]]")) {
          const title = part.slice(2, -2).trim();
          if (linkResolvable(title)) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onWikiLink(title)}
                className="text-[var(--accent)] underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {title}
              </button>
            );
          }
          return <span key={i} className="text-[var(--text-muted)]">{title}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function NoteMarkdown({ markdown, linkResolvable, onWikiLink }: Props) {
  const lines = markdown.split("\n");
  const out: React.ReactNode[] = [];
  const inline = (t: string) => (
    <Inline text={t} linkResolvable={linkResolvable} onWikiLink={onWikiLink} />
  );
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(<h3 key={i} className="font-head text-[var(--text-head)] text-sm mt-4 mb-1">{inline(line.slice(4))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(<h2 key={i} className="font-head text-[var(--text-head)] text-base mt-5 mb-1.5">{inline(line.slice(3))}</h2>);
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(<h1 key={i} className="font-head text-[var(--text-head)] text-lg mt-5 mb-2">{inline(line.slice(2))}</h1>);
      i++;
      continue;
    }

    // blockquote — consecutive `>` lines
    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoted.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-2 border-[var(--accent-line)] pl-3 my-2 text-[var(--text-body)] italic space-y-1"
        >
          {quoted.filter((q) => q.trim()).map((q, j) => (
            <p key={j}>{inline(q)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // pipe table
    if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const rows: string[][] = [];
      const cells = (l: string) =>
        l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const header = cells(line);
      i += 2; // skip header + separator
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push(
        <div key={`tbl-${i}`} className="my-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {header.map((h, j) => (
                  <th key={j} className="border border-[var(--border)] px-2 py-1 text-left text-[var(--text-primary)]">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-[var(--border)] px-2 py-1 text-[var(--text-body)]">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 text-[var(--text-body)] mb-2 space-y-0.5">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
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
      out.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 text-[var(--text-body)] mb-2 space-y-0.5">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ol>
      );
      continue;
    }

    out.push(
      <p key={i} className="text-[var(--text-body)] leading-relaxed mb-2">
        {inline(line)}
      </p>
    );
    i++;
  }

  return <div className="text-sm">{out}</div>;
}

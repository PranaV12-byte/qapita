"use client";

import { useEffect, useState } from "react";
import NoteMarkdown from "./NoteMarkdown";

// The vault reader (SPEC-VAULT V3, absorbs NodePanel). Fetches the selected
// note from /api/brain/note/[id] and renders it: kind chip + title + meta,
// scrollable markdown body (with [[wiki-links]] and backlinks that navigate
// in-app), and footer actions (Ask about this; Delete source). Desktop: a
// slide-in side pane beside the live graph. Mobile: a bottom sheet.

type NoteKind = "topic" | "source" | "user-node" | "general" | "pillar";
type BacklinkKind = NoteKind | "answer";
type Backlink = { id: string; kind: BacklinkKind; title: string; snippet: string };
type NotePage = {
  id: string;
  kind: NoteKind;
  title: string;
  meta: Record<string, string | number>;
  markdown: string;
  backlinks: Backlink[];
};

const KIND_LABEL: Record<NoteKind, string> = {
  topic: "Topic",
  source: "Your source",
  "user-node": "Your topic",
  general: "General",
  pillar: "Pillar",
};

type Props = {
  noteId: string | null;
  resolveTitle: (title: string) => string | null;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onAsk: (id: string, kind: NoteKind) => void;
  onDeleteSource: (sourceId: string) => void;
};

export default function NotePane({ noteId, resolveTitle, onNavigate, onClose, onAsk, onDeleteSource }: Props) {
  const [page, setPage] = useState<NotePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setPage(null);
    setConfirmDelete(false);
    fetch(`/api/brain/note/${encodeURIComponent(noteId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: NotePage) => {
        if (!cancelled) setPage(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (!noteId) return null;

  const metaEntries = page ? Object.entries(page.meta).filter(([, v]) => v !== "" && v !== undefined) : [];
  const isSource = page?.kind === "source";
  const sourceId = isSource ? noteId.replace(/^source:/, "") : null;

  return (
    <aside
      className="flex flex-col bg-[var(--surface-1)] border border-[var(--border-strong)] shadow-2xl
        md:absolute md:top-0 md:right-0 md:bottom-0 md:w-[420px] md:rounded-none md:border-l md:border-y-0 md:border-r-0
        fixed inset-x-0 bottom-0 z-30 max-h-[75vh] rounded-t-2xl md:max-h-none md:z-20"
      aria-label={page ? `Note: ${page.title}` : "Note"}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2 p-4 border-b border-[var(--border)] shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            {page ? KIND_LABEL[page.kind] : "Loading…"}
          </p>
          <h3 className="font-head text-lg text-[var(--text-head)] truncate">{page?.title ?? noteId}</h3>
          {metaEntries.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {metaEntries.map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close note"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          ✕
        </button>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="space-y-2">
            {[90, 80, 70, 85, 60].map((w, i) => (
              <div key={i} className="h-3 rounded bg-[var(--surface-2)] animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
        {notFound && !loading && (
          <p className="text-sm text-[var(--text-muted)]">This note couldn&apos;t be loaded.</p>
        )}
        {page && !loading && (
          <>
            <NoteMarkdown
              markdown={page.markdown}
              linkResolvable={(t) => resolveTitle(t) !== null}
              onWikiLink={(t) => {
                const id = resolveTitle(t);
                if (id) onNavigate(id);
              }}
            />

            {page.backlinks.length > 0 && (
              <div className="mt-6 border-t border-[var(--border)] pt-3">
                <button
                  type="button"
                  onClick={() => setShowBacklinks((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]"
                >
                  <span>{showBacklinks ? "▾" : "▸"}</span>
                  {page.backlinks.length} backlink{page.backlinks.length === 1 ? "" : "s"}
                </button>
                {showBacklinks && (
                  <ul className="mt-2 space-y-1.5">
                    {page.backlinks.map((b) => {
                      const navigable = b.kind !== "answer";
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            disabled={!navigable}
                            onClick={() => navigable && onNavigate(b.id)}
                            className={`w-full text-left rounded-lg border border-[var(--border)] px-2.5 py-1.5 ${
                              navigable ? "hover:border-[var(--accent)]" : "cursor-default opacity-80"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                                style={{
                                  background:
                                    b.kind === "source" || b.kind === "user-node"
                                      ? "var(--accent)"
                                      : b.kind === "answer"
                                        ? "var(--draft)"
                                        : "var(--text-muted)",
                                }}
                              />
                              <span className="text-sm text-[var(--text-body)] truncate">{b.title}</span>
                              <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--text-muted)] shrink-0">
                                {b.kind === "answer" ? "answer" : b.kind === "user-node" ? "your topic" : b.kind === "source" ? "your file" : b.kind}
                              </span>
                            </span>
                            {b.snippet && (
                              <span className="block text-xs text-[var(--text-muted)] mt-0.5 truncate">{b.snippet}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* footer actions */}
      {page && !loading && (
        <div className="border-t border-[var(--border)] p-3 flex flex-wrap items-center gap-2 shrink-0">
          {page.kind !== "source" && page.kind !== "pillar" && (
            <button
              type="button"
              onClick={() => onAsk(page.id, page.kind)}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent-solid)] text-[var(--accent-on)] px-4 text-sm font-medium"
              style={{ minHeight: 44 }}
            >
              Ask about this
            </button>
          )}
          {isSource && sourceId && (
            confirmDelete ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-body)]">Delete this source?</span>
                <button
                  type="button"
                  onClick={() => onDeleteSource(sourceId)}
                  className="rounded-lg border border-[var(--danger)] text-[var(--danger)] px-3 text-sm"
                  style={{ minHeight: 44 }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-[var(--border)] text-[var(--text-body)] px-3 text-sm"
                  style={{ minHeight: 44 }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-body)] px-4 text-sm hover:border-[var(--danger)] hover:text-[var(--danger)]"
                style={{ minHeight: 44 }}
              >
                Delete source
              </button>
            )
          )}
        </div>
      )}
    </aside>
  );
}

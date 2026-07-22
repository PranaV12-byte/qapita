"use client";

import { useRef, useState } from "react";

const ACCEPT = ".md,.markdown,.txt,.pdf,.docx,.csv,.tsv,.xlsx,.html,.htm,.json";

export default function UploadDropzone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className="rounded-xl border-2 border-dashed p-6 text-center transition-colors"
      style={{
        borderColor: over ? "var(--accent)" : "var(--border)",
        background: over ? "var(--surface-2)" : "transparent",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <p className="text-[var(--text-body)] mb-1">Drop files here to add them to your wiki</p>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        Markdown, text, PDF, Word, spreadsheets, HTML, JSON · up to 10 at a time
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center rounded-lg bg-[var(--accent-solid)] text-[var(--accent-on)] px-4 font-medium"
        style={{ minHeight: 44 }}
      >
        Choose files
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        style={{ fontSize: "16px" }}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

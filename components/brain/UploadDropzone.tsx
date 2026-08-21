"use client";

import { useRef, useState } from "react";

const ACCEPT =
  ".md,.markdown,.txt,.pdf,.docx,.csv,.tsv,.xlsx,.html,.htm,.json";

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
      className="rounded-[24px] border-2 border-dashed p-6 text-center transition-colors"
      style={{
        borderColor: over ? "var(--accent)" : "var(--border)",
        background: over ? "var(--surface-2)" : "white",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <p className="mb-1 text-[var(--text-body)]">
        Add company sources to support future drafts
      </p>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Upload plan documents, policy notes, spreadsheets, or reference files. Up to 10 files at a time.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center rounded-xl bg-[var(--accent-solid)] px-4 font-medium text-[var(--accent-on)]"
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

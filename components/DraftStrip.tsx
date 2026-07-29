import Link from "next/link";

const DRAFT_COPY =
  "Draft reference, not reviewed. Educational only, not advice.";

export default function DraftStrip() {
  return (
    <div
      className="z-50 flex w-full items-center justify-center bg-surface-2 px-4"
      style={{ height: "32px", minHeight: "32px" }}
    >
      <Link
        href="/legal/disclaimer"
        className="text-xs transition-opacity hover:opacity-80"
        style={{ textDecoration: "none", color: "var(--text-muted)" }}
      >
        <span style={{ color: "var(--draft)", fontWeight: 500 }}>Draft</span>
        <span>{DRAFT_COPY.slice(5)}</span>
      </Link>
    </div>
  );
}

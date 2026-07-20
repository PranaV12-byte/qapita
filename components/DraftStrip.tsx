import Link from "next/link";

const DRAFT_COPY = "Draft — AI-generated, not reviewed · Educational only, not advice";

export default function DraftStrip() {
  return (
    <div
      className="w-full bg-surface-2 flex items-center justify-center px-4 z-50"
      style={{ height: "32px", minHeight: "32px" }}
    >
      <Link
        href="/legal/disclaimer"
        className="text-xs hover:opacity-80 transition-opacity"
        style={{ textDecoration: "none", color: "var(--text-muted)" }}
      >
        <span style={{ color: "var(--draft)", fontWeight: 500 }}>Draft</span>
        <span>{DRAFT_COPY.slice(5)}</span>
      </Link>
    </div>
  );
}

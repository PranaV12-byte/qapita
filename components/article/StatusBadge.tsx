import type { Article } from "@/lib/content/schema";

const MAP: Record<Article["status"], { label: string; color: string }> = {
  generated: { label: "AI draft — not reviewed", color: "var(--draft)" },
  signed_off: { label: "Reviewed", color: "var(--certified)" },
};

export default function StatusBadge({ status }: { status: Article["status"] }) {
  const { label, color } = MAP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border"
      style={{ color, borderColor: color }}
    >
      <span
        aria-hidden="true"
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

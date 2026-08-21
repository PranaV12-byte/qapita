import type { Article } from "@/lib/content/schema";

const MAP: Record<Article["status"], { label: string; color: string }> = {
  generated: { label: "Draft", color: "var(--draft)" },
  signed_off: { label: "Reviewed", color: "var(--certified)" },
};

export default function StatusBadge({ status }: { status: Article["status"] }) {
  const { label, color } = MAP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
      style={{ color, borderColor: color }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

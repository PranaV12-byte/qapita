import Link from "next/link";
import { getNode } from "@/lib/content/tree";
import { articleExists } from "@/lib/content/loader";

export default function RelatedNodes({ ids }: { ids: string[] }) {
  const nodes = ids
    .map(getNode)
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .filter((n) => articleExists(n.pillarSlug, n.slug));
  if (!nodes.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
        Related topics
      </h2>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <Link
            key={n.id}
            href={`/a/${n.pillarSlug}/${n.slug}`}
            className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-body)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            style={{ textDecoration: "none" }}
          >
            {n.title}
          </Link>
        ))}
      </div>
    </section>
  );
}

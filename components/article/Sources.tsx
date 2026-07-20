import type { Article } from "@/lib/content/schema";

export default function Sources({ sources }: { sources: Article["sources"] }) {
  if (!sources.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
        Sources
      </h2>
      <ul className="space-y-1 text-sm text-[var(--text-body)]">
        {sources.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ·
            </span>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                {s.label}
              </a>
            ) : (
              <span>{s.label}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

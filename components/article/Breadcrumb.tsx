import Link from "next/link";

type Crumb = { label: string; href?: string };

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="v9-breadcrumb mb-4">
      <ol className="v9-breadcrumb-list flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="v9-breadcrumb-item flex items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="v9-breadcrumb-link hover:text-[var(--text-body)] transition-colors"
                  style={{ textDecoration: "none" }}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  style={{ color: last ? "var(--text-body)" : undefined }}
                >
                  {item.label}
                </span>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

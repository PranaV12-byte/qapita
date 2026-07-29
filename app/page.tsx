import Link from "next/link";
import PortalShell from "@/components/portal/PortalShell";
import { DISPLAY_PILLARS } from "@/lib/content/tree";

function pillarSummary(title: string): string {
  return title.replace(/\s*\([^)]*\)/g, "").replace(/ & /g, ", ");
}

export default function HomePage() {
  return (
    <PortalShell>
      <div className="space-y-8">
        <section className="q-shell-card overflow-hidden">
          <div className="grid gap-10 px-6 py-8 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-end">
            <div className="space-y-6">
              <div className="q-chip w-fit border border-[#8fd5a6] bg-[#eefaf2] text-[#22894f]">
                <span className="inline-block h-2 w-2 rounded-full bg-[#22b45a]" />
                Endorsed by NASPP
              </div>
              <div className="space-y-4">
                <h1 className="font-head text-4xl leading-tight text-[var(--text-head)] md:text-6xl">
                  Increase your EquityIQ.
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-[var(--text-body)]">
                  Professional-grade US equity compensation knowledge and ready-to-share drafting for the teams who run stock plans.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/generate"
                  className="inline-flex min-h-[50px] items-center rounded-xl bg-[var(--accent-solid)] px-6 text-sm font-semibold text-white"
                  style={{ textDecoration: "none" }}
                >
                  Generate a draft
                </Link>
                <Link
                  href="/browse"
                  className="inline-flex min-h-[50px] items-center rounded-xl border border-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent)]"
                  style={{ textDecoration: "none" }}
                >
                  Browse the knowledge tree
                </Link>
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-2)] p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
                Working reference
              </p>
              <h2 className="mt-3 font-head text-2xl text-[var(--text-head)]">
                Describe your situation and prepare a document you can share.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-body)]">
                Move from tax withholding questions to participant communications with a structured draft grounded in the reviewed library.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-head text-3xl text-[var(--text-head)]">
                The knowledge tree
              </h2>
              <p className="mt-2 text-[var(--text-body)]">
                Seven core pillars across award design, lifecycle events, tax, accounting, compliance, and administration.
              </p>
            </div>
            <Link
              href="/browse"
              className="text-sm font-semibold text-[var(--accent)]"
              style={{ textDecoration: "none" }}
            >
              View all 7 pillars
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {DISPLAY_PILLARS.map((pillar) => (
              <Link
                key={pillar.id}
                href={`/p/${pillar.slug}`}
                className="q-card-link block p-5"
                style={{ textDecoration: "none" }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                  {String(pillar.id).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-head text-2xl leading-tight text-[var(--text-head)]">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">
                  {pillar.nodes
                    .slice(0, 3)
                    .map((node) => pillarSummary(node.title))
                    .join(", ")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}

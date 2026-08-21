import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/article/Breadcrumb";
import KnowledgeCenter from "@/components/knowledge/KnowledgeCenter";
import PortalShell from "@/components/portal/PortalShell";
import { loadGlossary } from "@/lib/content/glossary";
import { articleExists } from "@/lib/content/loader";
import { DISPLAY_PILLARS, PILLARS, getPillar } from "@/lib/content/tree";

type Params = { pillar: string };

export function generateStaticParams() {
  return PILLARS.map((pillar) => ({ pillar: pillar.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pillar } = await params;
  const resolved = getPillar(pillar);
  return {
    title: resolved ? `${resolved.title} - Q4N$P` : "Not found - Q4N$P",
  };
}

export default async function PillarPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { pillar } = await params;
  const resolved = getPillar(pillar);
  if (!resolved) notFound();

  const terms = loadGlossary();
  const pillars = DISPLAY_PILLARS.map((item) => ({
    ...item,
    nodes: item.nodes.map((node) => ({
      ...node,
      ready: articleExists(node.pillarSlug, node.slug),
    })),
    readyCount: item.nodes.filter((node) =>
      articleExists(node.pillarSlug, node.slug)
    ).length,
  }));

  return (
    <PortalShell>
      <Breadcrumb
        items={[
          { label: "Knowledge Tree", href: "/browse" },
          { label: resolved.title },
        ]}
      />
      <div className="mb-8">
        <h1 className="font-head text-5xl text-[var(--text-head)]">
          {resolved.title}
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--text-body)]">
          Browse this knowledge group, then open a published Wiki article or start a draft from guidance that matches your situation.
        </p>
      </div>
      <KnowledgeCenter
        pillars={pillars}
        terms={terms}
        initialPillarSlug={resolved.slug}
      />
    </PortalShell>
  );
}

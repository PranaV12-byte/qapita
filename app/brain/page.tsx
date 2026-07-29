import type { Metadata } from "next";
import { headers } from "next/headers";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { composeGraphModel } from "@/lib/brain/graph";
import { loadAllArticles } from "@/lib/content/loader";
import BrainClient from "./client";

export const metadata: Metadata = {
  title: "My Brain — Q4N$P",
  description: "Your personal equity-comp wiki: add sources, then ask against them.",
  robots: "noindex",
};

// Cookie/brain-dependent — never statically cached.
export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const brainId = getBrainId(await headers());
  const manifest = brainId ? brainStore.loadManifest(brainId) : null;

  // Curated node→node "related" pairs from article frontmatter — the
  // foundation's related edges (kept out of lib/brain/graph.ts so that stays
  // pure/unit-testable without loading MDX).
  const articles = await loadAllArticles();
  const relatedTreeEdges = articles.flatMap((art) =>
    art.frontmatter.related.map((r) => ({ a: art.frontmatter.id, b: r }))
  );

  const model = composeGraphModel(brainId, { relatedTreeEdges });

  return (
    <BrainClient
      brainId={brainId ?? ""}
      model={model}
      counts={manifest?.counts ?? { sources: 0, passages: 0 }}
      lint={manifest?.lint ?? { lastLintAt: null, appendsSinceLint: 0 }}
    />
  );
}

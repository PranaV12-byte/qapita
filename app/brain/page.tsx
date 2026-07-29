import type { Metadata } from "next";
import { headers } from "next/headers";
import BrainClient from "./client";
import { composeGraphModel } from "@/lib/brain/graph";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { loadAllArticles } from "@/lib/content/loader";

export const metadata: Metadata = {
  title: "Brain workspace - Q4N$P",
  description:
    "Manage private source material and review the connected knowledge graph.",
  robots: "noindex",
};

export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const brainId = getBrainId(await headers());
  const manifest = brainId ? brainStore.loadManifest(brainId) : null;
  const articles = await loadAllArticles();
  const relatedTreeEdges = articles.flatMap((article) =>
    article.frontmatter.related.map((related) => ({
      a: article.frontmatter.id,
      b: related,
    }))
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

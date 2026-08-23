import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PILLARS, getPillar } from "@/lib/content/tree";
import { getV9Subtopic, toV9TopicId } from "@/lib/content/v9-taxonomy";

type Params = { pillar: string };

export function generateStaticParams() {
  return PILLARS.map((pillar) => ({ pillar: pillar.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { pillar } = await params;
  const resolved = getPillar(pillar);
  return { title: resolved ? `${resolved.title} | EquityIQ` : "Not found | EquityIQ" };
}

/** Legacy pillar URLs remain valid and resolve into their V9 Knowledge Tree group. */
export default async function PillarPage({ params }: { params: Promise<Params> }) {
  const { pillar } = await params;
  const legacyPillar = getPillar(pillar);
  if (!legacyPillar) notFound();
  const v9Id = toV9TopicId(legacyPillar.nodes[0]?.id);
  const groupId = v9Id ? getV9Subtopic(v9Id)?.id.split(".")[0] : undefined;
  redirect(groupId ? `/browse?group=${encodeURIComponent(groupId)}` : "/browse");
}

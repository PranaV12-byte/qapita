import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getLLMProvider } from "@/lib/llm/provider";
import { logArtifact } from "@/lib/log";
import { SCENARIOS } from "@/lib/scenarios";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { retrieveForBrain } from "@/lib/brain/retrieval";
import type { ArtifactFormat } from "@/lib/llm/types";
import { normalizeGeneratedArtifact } from "@/lib/llm/output-normalizer";
import { selectAnswerGrounding } from "@/lib/llm/grounding";
import { gracefulUnknown, isGracefulUnknownArtifact } from "@/lib/llm/mock";
import { z } from "zod";
import { primaryLegacyTopicId, toV9TopicId } from "@/lib/content/v9-taxonomy";

export const runtime = "nodejs";

const artifactRequestSchema = z.object({
  query: z.string().trim().min(1).max(4_000).optional(),
  scenarioId: z.string().max(100).optional(),
  nodeId: z.string().max(200).optional(),
  format: z.enum(["reference", "pdf", "email", "comparison"]).optional(),
});

export async function POST(req: NextRequest) {
  const parsedBody = artifactRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_artifact_request" }, { status: 400 });
  }
  const body = parsedBody.data as {
    query?: string;
    scenarioId?: string;
    nodeId?: string;
    format?: ArtifactFormat;
  };

  const { query: rawQuery, scenarioId, nodeId, format = "reference" } = body;

  if (!rawQuery && !scenarioId) {
    return NextResponse.json({ error: "empty_query" }, { status: 400 });
  }

  let query = rawQuery ?? "";
  let scenario: { id: string; label: string } | null = null;
  let boostNodeId = nodeId;
  const v9TopicId = toV9TopicId(nodeId);
  if (v9TopicId) boostNodeId = primaryLegacyTopicId(v9TopicId) ?? nodeId;

  if (scenarioId) {
    const found = SCENARIOS.find((s) => s.id === scenarioId);
    if (found) {
      query = found.label;
      scenario = { id: found.id, label: found.label };
      if (!boostNodeId && found.nodeIds.length > 0) {
        boostNodeId = found.nodeIds[0];
      }
    }
  }

  // Brain-aware: retrieve against the caller's wiki (foundation ⊕ their delta).
  // No brain / an empty brain → foundation-only, byte-identical to before.
  const brainId = getBrainId(req.headers);
  let retrieval;
  try {
    retrieval = await retrieveForBrain(query, brainId, { nodeId: boostNodeId });
  } catch (error) {
    console.error("Artifact retrieval failed", error);
    return NextResponse.json({ error: "retrieval_unavailable" }, { status: 503 });
  }

  const grounding = selectAnswerGrounding(query, retrieval.chunks);
  let result;
  try {
    const provider = getLLMProvider();
    result = normalizeGeneratedArtifact(
      grounding.answerable
        ? await provider.generate(query, grounding.chunks, { format })
        : gracefulUnknown(query)
    );
  } catch (error) {
    console.error("Artifact generation failed", error);
    return NextResponse.json({ error: "generation_unavailable" }, { status: 503 });
  }

  const answerAvailable = grounding.answerable && !isGracefulUnknownArtifact(result);

  const mode = process.env.LLM_PROVIDER ?? "mock";
  const matchedNodeIds = [
    ...new Set(
      grounding.chunks.map((c) => c.nodeId).filter((id): id is string => !!id)
    ),
  ];

  const { logged } = await logArtifact({
    mode,
    query,
    scenarioId,
    matchedNodeIds,
    fallbackUsed: retrieval.fallbackUsed || !grounding.answerable,
  });

  const artifactId = randomUUID();

  // Per-brain answer log — powers node backlinks + a recent-questions list.
  // Only when the caller actually has a wiki (avoids creating a brain dir on
  // a bare chat visit).
  if (answerAvailable && brainId && brainStore.brainExists(brainId)) {
    brainStore.appendAnswer(brainId, {
      artifactId,
      query,
      title: result.title,
      citations: result.citations,
      ts: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    artifactId,
    title: result.title,
    bodyMarkdown: result.bodyMarkdown,
    quickShare: result.quickShare,
    citations: result.citations,
    status: "generated",
    answerAvailable,
    fallbackUsed: retrieval.fallbackUsed || !grounding.answerable,
    fallbackScenario: retrieval.fallbackScenario,
    scenario,
    logged,
  });
}

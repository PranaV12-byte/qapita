import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getLLMProvider } from "@/lib/llm/provider";
import { logArtifact } from "@/lib/log";
import { SCENARIOS } from "@/lib/scenarios";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { resolveCitations, retrieveForBrain } from "@/lib/brain/retrieval";
import type { ArtifactFormat, ArtifactResult } from "@/lib/llm/types";
import { isUsableGeneratedArtifact, normalizeGeneratedArtifact } from "@/lib/llm/output-normalizer";
import { selectAnswerGrounding } from "@/lib/llm/grounding";
import {
  MockLLM,
  gracefulComparisonRefinement,
  gracefulOffTopic,
  gracefulUnknown,
  isGracefulUnknownArtifact,
} from "@/lib/llm/mock";
import { buildDefinitionRetrievalQuery, getQueryIntent, isClearlyOffTopicQuery } from "@/lib/llm/query-intent";
import { getNode } from "@/lib/content/tree";
import { z } from "zod";
import { primaryLegacyTopicId, toV9TopicId } from "@/lib/content/v9-taxonomy";

export const runtime = "nodejs";

/**
 * Primary answer boundary. It validates the request, selects grounded evidence,
 * chooses a provider or fallback, and returns one normalized artifact shape for
 * the screen, PDF, email, citations, and Brain backlinks to share.
 */
const artifactRequestSchema = z.object({
  query: z.string().trim().min(1).max(4_000).optional(),
  scenarioId: z.string().max(100).optional(),
  nodeId: z.string().max(200).optional(),
  format: z.enum(["reference", "pdf", "email", "comparison"]).optional(),
});

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
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

  const detectedIntent = getQueryIntent(query);
  const definitionTopic = detectedIntent.kind === "definition"
    ? (getNode(boostNodeId ?? "") ?? getNode(detectedIntent.nodeId))
    : undefined;
  const definitionNodeId = definitionTopic?.id;
  const queryIntent = detectedIntent.kind === "definition" && definitionTopic
    ? { kind: "definition" as const, nodeId: definitionTopic.id, title: definitionTopic.title, facets: detectedIntent.facets, topics: detectedIntent.topics }
    : detectedIntent;
  const retrievalQuery = detectedIntent.kind === "definition" && definitionTopic
    ? buildDefinitionRetrievalQuery(query, definitionTopic)
    : query;

  // Brain-aware: retrieve against the caller's wiki (foundation ⊕ their delta).
  // No brain / an empty brain → foundation-only, byte-identical to before.
  const brainId = getBrainId(req.headers);
  let retrieval;
  try {
    retrieval = await retrieveForBrain(retrievalQuery, brainId, {
      nodeId: boostNodeId,
      topK: queryIntent.kind === "comparison" || (queryIntent.facets?.length ?? 0) >= 2 ? 16 : 12,
    });
  } catch {
    console.error("Artifact retrieval failed");
    return NextResponse.json({ error: "retrieval_unavailable" }, { status: 503 });
  }

  const grounding = selectAnswerGrounding(query, retrieval.chunks, {
    definitionNodeId,
    intent: queryIntent,
  });
  let result: ArtifactResult & { answerAvailable?: boolean };
  try {
    const provider = getLLMProvider();
    const trustedCitations = grounding.answerable ? resolveCitations(grounding.chunks, brainId) : [];
    const trustedIdentifiers = grounding.chunks.flatMap((chunk) => [chunk.nodeId, chunk.sourceId].filter((id): id is string => Boolean(id)));
    const generateDeterministic = () => new MockLLM().generate(query, grounding.chunks, { format, queryIntent });
    let generated: ArtifactResult;
    if (!grounding.answerable) {
      generated = queryIntent.kind === "comparison"
        ? gracefulComparisonRefinement(query)
        : isClearlyOffTopicQuery(query) ? gracefulOffTopic(query) : gracefulUnknown(query);
    } else {
      try {
        generated = await provider.generate(query, grounding.chunks, { format, queryIntent });
      } catch {
        console.log(JSON.stringify({ event: "provider_fallback", provider: process.env.LLM_PROVIDER ?? "mock", reason: "provider_exception" }));
        generated = await generateDeterministic();
      }
    }
    let normalized = normalizeGeneratedArtifact({ ...generated, citations: [] }, query, trustedIdentifiers);
    if (!isUsableGeneratedArtifact(normalized) && grounding.answerable) {
      generated = await generateDeterministic();
      normalized = normalizeGeneratedArtifact({ ...generated, citations: [] }, query, trustedIdentifiers);
    }
    if (!isUsableGeneratedArtifact(normalized)) throw new Error("generated_artifact_invalid");
    const unavailable = isGracefulUnknownArtifact(normalized);
    result = {
      ...normalized,
      citations: grounding.answerable && !unavailable ? trustedCitations : [],
    };
    result.answerAvailable = grounding.answerable && !unavailable;
  } catch {
    console.error("Artifact generation failed");
    return NextResponse.json({ error: "generation_unavailable" }, { status: 503 });
  }

  const answerAvailable = result.answerAvailable ?? (grounding.answerable && !isGracefulUnknownArtifact(result));
  const fallbackUsed = retrieval.fallbackUsed && !grounding.answerable;
  const answerUnavailableReason = answerAvailable
    ? undefined
    : queryIntent.kind === "comparison"
      ? "comparison-refinement"
      : isClearlyOffTopicQuery(query) ? "off-topic" : "content-gap";

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
    format,
    matchedNodeIds,
    fallbackUsed,
    intent: queryIntent.kind,
    facets: queryIntent.facets,
    retrievedCount: retrieval.chunks.length,
    groundedCount: grounding.chunks.length,
    answerWordCount: result.bodyMarkdown.split(/\s+/).filter(Boolean).length,
    durationMs: Date.now() - startedAt,
    outcome: answerAvailable ? "success" : answerUnavailableReason,
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
    ...(result.comparison ? { comparison: result.comparison } : {}),
    status: "generated",
    answerAvailable,
    ...(answerUnavailableReason ? { answerUnavailableReason } : {}),
    fallbackUsed,
    fallbackScenario: retrieval.fallbackScenario,
    scenario,
    logged,
  });
}

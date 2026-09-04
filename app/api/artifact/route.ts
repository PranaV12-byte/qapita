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
import { isGeneratedBodyGrounded, selectAnswerGrounding } from "@/lib/llm/grounding";
import { createEvidenceProfile, type EvidenceProfile } from "@/lib/llm/answer-composer";
import { composeBatchAnswer, type AnswerPart } from "@/lib/llm/batch-answer";
import { splitIndependentQuestions } from "@/lib/llm/query-batch";
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

const RETRIEVAL_CONCURRENCY = 4;

function retrievalTopK(intent: ReturnType<typeof getQueryIntent>): number {
  if (intent.kind === "definition" || intent.scope === "broad" || intent.scope === "vague") return 80;
  if (intent.kind === "comparison" || (intent.facets?.length ?? 0) >= 2) return 48;
  return 32;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      output[index] = await mapper(values[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return output;
}

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

  const brainId = getBrainId(req.headers);
  const questionBatch = splitIndependentQuestions(query);

  // Several separate questions are composed deterministically from independent
  // grounding sets. A single provider call could let the strongest topic crowd
  // out the others, especially in serverless deployments.
  if (questionBatch.parts.length > 1) {
    if (format === "comparison") {
      const generated = gracefulComparisonRefinement(query);
      const result = normalizeGeneratedArtifact(generated, query);
      const reason = "comparison-refinement";
      const { logged } = await logArtifact({
        mode: process.env.LLM_PROVIDER ?? "mock",
        scenarioId,
        format,
        intent: "multi-question",
        scope: "multi-question",
        partCount: questionBatch.parts.length,
        retrievedCount: 0,
        groundedCount: 0,
        answerWordCount: 0,
        durationMs: Date.now() - startedAt,
        outcome: reason,
      });
      return NextResponse.json({
        artifactId: randomUUID(),
        ...result,
        status: "generated",
        answerAvailable: false,
        answerUnavailableReason: reason,
        fallbackUsed: false,
        scenario,
        logged,
      });
    }

    let parts: AnswerPart[];
    try {
      parts = await mapWithConcurrency(questionBatch.parts, RETRIEVAL_CONCURRENCY, async (partQuery) => {
        const intent = getQueryIntent(partQuery);
        const definitionTopic = intent.kind === "definition" ? getNode(intent.nodeId) : undefined;
        const queryIntent = intent.kind === "definition" && definitionTopic
          ? { kind: "definition" as const, nodeId: definitionTopic.id, title: definitionTopic.title, facets: intent.facets, topics: intent.topics, scope: intent.scope }
          : intent;
        const retrievalQuery = intent.kind === "definition" && definitionTopic
          ? buildDefinitionRetrievalQuery(partQuery, definitionTopic)
          : partQuery;
        const retrieval = await retrieveForBrain(retrievalQuery, brainId, {
          topK: retrievalTopK(queryIntent),
        });
        const grounding = selectAnswerGrounding(partQuery, retrieval.chunks, {
          definitionNodeId: definitionTopic?.id,
          intent: queryIntent,
        });
        const profile = grounding.answerable
          ? createEvidenceProfile(partQuery, grounding.chunks, queryIntent)
          : undefined;
        return {
          query: partQuery,
          intent: queryIntent,
          chunks: grounding.chunks,
          profile,
          citations: grounding.answerable ? resolveCitations(grounding.chunks, brainId) : [],
        };
      });
    } catch {
      console.error("Artifact batch retrieval failed");
      return NextResponse.json({ error: "retrieval_unavailable" }, { status: 503 });
    }

    const batch = composeBatchAnswer(parts);
    const allGroundedChunks = parts.flatMap((part) => part.chunks);
    const trustedIdentifiers = allGroundedChunks.flatMap((chunk) => [chunk.nodeId, chunk.sourceId]
      .filter((id): id is string => Boolean(id)));
    const generated = batch.answerAvailable
      ? batch
      : isClearlyOffTopicQuery(query)
        ? gracefulOffTopic(query)
        : gracefulUnknown(query);
    const normalized = normalizeGeneratedArtifact({ ...generated, citations: [] }, query, trustedIdentifiers);
    if (!isUsableGeneratedArtifact(normalized)) {
      console.error("Artifact batch composition failed");
      return NextResponse.json({ error: "generation_unavailable" }, { status: 503 });
    }
    const answerAvailable = batch.answerAvailable;
    const result = {
      ...normalized,
      citations: answerAvailable ? batch.citations : [],
    };
    const matchedNodeIds = [...new Set(allGroundedChunks.map((chunk) => chunk.nodeId).filter((id): id is string => Boolean(id)))];
    const { logged } = await logArtifact({
      mode: "deterministic-batch",
      scenarioId,
      format,
      matchedNodeIds,
      intent: "multi-question",
      scope: "multi-question",
      partCount: parts.length,
      evidenceTiers: parts.map((part) => part.profile?.tier ?? "none"),
      relevantWordCount: parts.reduce((count, part) => count + (part.profile?.relevantWordCount ?? 0), 0),
      retrievedCount: parts.reduce((count, part) => count + part.chunks.length, 0),
      groundedCount: allGroundedChunks.length,
      answerWordCount: result.bodyMarkdown.split(/\s+/).filter(Boolean).length,
      durationMs: Date.now() - startedAt,
      outcome: answerAvailable ? "success" : isClearlyOffTopicQuery(query) ? "off-topic" : "content-gap",
    });
    const artifactId = randomUUID();
    if (answerAvailable && brainId && brainStore.brainExists(brainId)) {
      brainStore.appendAnswer(brainId, { artifactId, query, title: result.title, citations: result.citations, ts: new Date().toISOString() });
    }
    return NextResponse.json({
      artifactId,
      title: result.title,
      bodyMarkdown: result.bodyMarkdown,
      quickShare: result.quickShare,
      citations: result.citations,
      status: "generated",
      answerAvailable,
      ...(!answerAvailable ? { answerUnavailableReason: isClearlyOffTopicQuery(query) ? "off-topic" : "content-gap" } : {}),
      fallbackUsed: false,
      scenario,
      logged,
    });
  }

  const detectedIntent = getQueryIntent(query);
  const definitionTopic = detectedIntent.kind === "definition"
    ? (getNode(boostNodeId ?? "") ?? getNode(detectedIntent.nodeId))
    : undefined;
  const definitionNodeId = definitionTopic?.id;
  const queryIntent = detectedIntent.kind === "definition" && definitionTopic
    ? { kind: "definition" as const, nodeId: definitionTopic.id, title: definitionTopic.title, facets: detectedIntent.facets, topics: detectedIntent.topics, scope: detectedIntent.scope }
    : detectedIntent;
  const retrievalQuery = detectedIntent.kind === "definition" && definitionTopic
    ? buildDefinitionRetrievalQuery(query, definitionTopic)
    : query;

  // Brain-aware: retrieve against the caller's wiki (foundation ⊕ their delta).
  // No brain / an empty brain → foundation-only, byte-identical to before.
  let retrieval;
  try {
    retrieval = await retrieveForBrain(retrievalQuery, brainId, {
      nodeId: boostNodeId,
      topK: retrievalTopK(queryIntent),
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
  let evidenceProfile: EvidenceProfile | undefined;
  try {
    const provider = getLLMProvider();
    const trustedCitations = grounding.answerable ? resolveCitations(grounding.chunks, brainId) : [];
    const trustedIdentifiers = grounding.chunks.flatMap((chunk) => [chunk.nodeId, chunk.sourceId].filter((id): id is string => Boolean(id)));
    evidenceProfile = grounding.answerable
      ? createEvidenceProfile(query, grounding.chunks, queryIntent)
      : undefined;
    const generateDeterministic = () => new MockLLM().generate(query, grounding.chunks, { format, queryIntent, evidenceProfile });
    let generated: ArtifactResult;
    if (!grounding.answerable) {
      generated = queryIntent.kind === "comparison"
        ? gracefulComparisonRefinement(query)
        : isClearlyOffTopicQuery(query) ? gracefulOffTopic(query) : gracefulUnknown(query);
    } else {
      try {
        generated = await provider.generate(query, grounding.chunks, { format, queryIntent, evidenceProfile });
      } catch {
        console.log(JSON.stringify({ event: "provider_fallback", provider: process.env.LLM_PROVIDER ?? "mock", reason: "provider_exception" }));
        generated = await generateDeterministic();
      }
    }
    const normalizeCandidate = (candidate: ArtifactResult): ArtifactResult | null => {
      try {
        return normalizeGeneratedArtifact({ ...candidate, citations: [] }, query, trustedIdentifiers);
      } catch {
        // A provider can satisfy its outer JSON shape while returning an
        // invalid nested comparison or another value rejected by the final
        // normalizer. Treat that as provider output failure and reuse the
        // already-selected Wiki evidence instead of turning it into a 503.
        return null;
      }
    };

    let normalized = normalizeCandidate(generated);
    const providerOutputIsGrounded = !normalized ? false : !grounding.answerable || isGeneratedBodyGrounded(
      query,
      normalized.bodyMarkdown,
      grounding.chunks,
      queryIntent,
      evidenceProfile?.tier
    );
    if ((!normalized || !isUsableGeneratedArtifact(normalized) || !providerOutputIsGrounded) && grounding.answerable) {
      if (!providerOutputIsGrounded) {
        console.log(JSON.stringify({ event: "provider_fallback", reason: "ungrounded_or_too_short" }));
      }
      generated = await generateDeterministic();
      normalized = normalizeCandidate(generated);
    }
    if (!normalized || !isUsableGeneratedArtifact(normalized)) throw new Error("generated_artifact_invalid");
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
    scenarioId,
    format,
    matchedNodeIds,
    fallbackUsed,
    intent: queryIntent.kind,
    scope: queryIntent.scope,
    facets: queryIntent.facets,
    evidenceTier: evidenceProfile?.tier,
    relevantWordCount: evidenceProfile?.relevantWordCount,
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

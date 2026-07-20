import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { retrieve } from "@/lib/rag/retriever";
import { getLLMProvider } from "@/lib/llm/provider";
import { logArtifact } from "@/lib/log";
import { SCENARIOS } from "@/lib/scenarios";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    query?: string;
    scenarioId?: string;
    nodeId?: string;
  };

  const { query: rawQuery, scenarioId, nodeId } = body;

  if (!rawQuery && !scenarioId) {
    return NextResponse.json({ error: "empty_query" }, { status: 400 });
  }

  let query = rawQuery ?? "";
  let scenario: { id: string; label: string } | null = null;
  let boostNodeId = nodeId;

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

  const retrieval = await retrieve(query, boostNodeId);
  const provider = getLLMProvider();
  const result = await provider.generate(query, retrieval.chunks);

  const mode = process.env.LLM_PROVIDER ?? "mock";
  const matchedNodeIds = [
    ...new Set(
      retrieval.chunks.map((c) => c.nodeId).filter((id): id is string => !!id)
    ),
  ];

  const { logged } = await logArtifact({
    mode,
    query,
    scenarioId,
    matchedNodeIds,
    fallbackUsed: retrieval.fallbackUsed,
  });

  return NextResponse.json({
    artifactId: randomUUID(),
    title: result.title,
    bodyMarkdown: result.bodyMarkdown,
    quickShare: result.quickShare,
    citations: result.citations,
    status: "generated",
    fallbackUsed: retrieval.fallbackUsed,
    fallbackScenario: retrieval.fallbackScenario,
    scenario,
    logged,
  });
}

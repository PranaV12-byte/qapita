import { NextRequest, NextResponse } from "next/server";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { loadGraph } from "@/lib/brain/weave";
import { loadLintReport, runLint } from "@/lib/brain/lint";
import { LINT_APPEND_THRESHOLD, LINT_STALE_DAYS } from "@/lib/rag/config";
import { erasePersistedBrain, hydrateBrain } from "@/lib/brain/persistence";

export const runtime = "nodejs";

/** Is a cadence lint due? (>= N appends since last lint, or > M days stale.) */
function lintDue(lint: { lastLintAt: string | null; appendsSinceLint: number }): boolean {
  if (lint.appendsSinceLint >= LINT_APPEND_THRESHOLD) return true;
  if (!lint.lastLintAt) return lint.appendsSinceLint > 0;
  const ageDays = (Date.now() - new Date(lint.lastLintAt).getTime()) / (24 * 60 * 60 * 1000);
  return ageDays > LINT_STALE_DAYS;
}

/** GET /api/brain — manifest + graph + lint status for the caller's brain.
 *  No brain yet (never uploaded anything) -> a sensible empty shape, not an
 *  error: that's the normal state for a first-time visitor. */
export async function GET(req: NextRequest) {
  const brainId = getBrainId(req.headers);
  if (!brainId) {
    return NextResponse.json({ error: "missing_brain_id" }, { status: 400 });
  }
  await hydrateBrain(brainId);

  const manifest = brainStore.loadManifest(brainId);
  if (!manifest) {
    return NextResponse.json({
      brainId,
      sources: {},
      counts: { sources: 0, passages: 0 },
      graph: { userNodes: {}, edges: [], nodeSummaries: {} },
      // Keep the empty response compatible with the manifest returned after a first upload.
      lint: { lastLintAt: null, appendsSinceLint: 0 },
    });
  }

  // Opportunistic cadence lint — fire-and-forget so GET stays fast. The next
  // GET reflects the fresh report; this one returns whatever's on disk now.
  if (lintDue(manifest.lint)) {
    void runLint(brainId).catch(() => {
      /* lint never blocks a read; failures are swallowed */
    });
  }

  return NextResponse.json({
    brainId,
    sources: manifest.sources,
    counts: manifest.counts,
    graph: loadGraph(brainId),
    lint: manifest.lint,
    lintReport: loadLintReport(brainId),
  });
}

/** DELETE /api/brain — erase the caller's entire brain. Requires the client
 *  to echo its own brainId back as a confirmation speed bump against a bare
 *  accidental DELETE (not a security boundary — same-origin + SameSite=Lax
 *  already cover that; this just guards against "oops"). */
export async function DELETE(req: NextRequest) {
  const brainId = getBrainId(req.headers);
  if (!brainId) {
    return NextResponse.json({ error: "missing_brain_id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { confirmBrainId?: string };
  if (body.confirmBrainId !== brainId) {
    return NextResponse.json(
      {
        error: "confirm_required",
        message: "Pass { confirmBrainId: <your brainId> } to erase your wiki.",
      },
      { status: 400 }
    );
  }

  brainStore.eraseBrain(brainId);
  await erasePersistedBrain(brainId);
  return NextResponse.json({ ok: true, erased: brainId });
}

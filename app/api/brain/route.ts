import { NextRequest, NextResponse } from "next/server";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { loadGraph } from "@/lib/brain/weave";

export const runtime = "nodejs";

/** GET /api/brain — manifest + graph + lint status for the caller's brain.
 *  No brain yet (never uploaded anything) -> a sensible empty shape, not an
 *  error: that's the normal state for a first-time visitor. */
export async function GET(req: NextRequest) {
  const brainId = getBrainId(req.headers);
  if (!brainId) {
    return NextResponse.json({ error: "missing_brain_id" }, { status: 400 });
  }

  const manifest = brainStore.loadManifest(brainId);
  if (!manifest) {
    return NextResponse.json({
      brainId,
      sources: {},
      counts: { sources: 0, passages: 0 },
      graph: { userNodes: {}, edges: [], nodeSummaries: {} },
      // Lint fields stubbed here — Phase 5 wires the real cadence/engine.
      lint: { lastLintAt: null, appendsSinceLint: 0 },
    });
  }

  return NextResponse.json({
    brainId,
    sources: manifest.sources,
    counts: manifest.counts,
    graph: loadGraph(brainId),
    lint: manifest.lint,
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
  return NextResponse.json({ ok: true, erased: brainId });
}

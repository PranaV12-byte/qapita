import { NextRequest, NextResponse } from "next/server";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { removeSource } from "@/lib/brain/weave";

export const runtime = "nodejs";

/** DELETE /api/brain/sources/[sourceId] — remove one source and everything
 *  it wove into the graph. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const brainId = getBrainId(req.headers);
  if (!brainId) {
    return NextResponse.json({ error: "missing_brain_id" }, { status: 400 });
  }
  const { sourceId } = await params;

  const manifest = brainStore.loadManifest(brainId);
  if (!manifest || !manifest.sources[sourceId]) {
    return NextResponse.json({ error: "source_not_found" }, { status: 404 });
  }

  const result = await removeSource(brainId, sourceId);
  return NextResponse.json({ ok: true, ...result });
}

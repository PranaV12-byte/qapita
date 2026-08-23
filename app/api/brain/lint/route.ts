import { NextRequest, NextResponse } from "next/server";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { runLint } from "@/lib/brain/lint";
import { hydrateBrain, persistBrain } from "@/lib/brain/persistence";

export const runtime = "nodejs";

/** POST /api/brain/lint — run the wiki health check on demand (synchronous;
 *  returns the fresh report). */
export async function POST(req: NextRequest) {
  const brainId = getBrainId(req.headers);
  if (!brainId) {
    return NextResponse.json({ error: "missing_brain_id" }, { status: 400 });
  }
  await hydrateBrain(brainId);
  if (!brainStore.brainExists(brainId)) {
    return NextResponse.json({ error: "no_brain", message: "Nothing to lint yet." }, { status: 404 });
  }
  const report = await runLint(brainId);
  await persistBrain(brainId);
  return NextResponse.json({ ok: true, report });
}

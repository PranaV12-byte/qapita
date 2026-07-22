import { NextRequest, NextResponse } from "next/server";
import { getBrainId } from "@/lib/brain/id";
import { applyFinding } from "@/lib/brain/lint";

export const runtime = "nodejs";

/** POST /api/brain/lint/apply — apply an auto-applicable structural fix, or
 *  dismiss a finding. body: { findingId: string, action: "apply" | "dismiss" }.
 *  Destructive fixes are never executed here — those route through the source
 *  DELETE endpoint after user confirm. */
export async function POST(req: NextRequest) {
  const brainId = getBrainId(req.headers);
  if (!brainId) {
    return NextResponse.json({ error: "missing_brain_id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { findingId?: string; action?: string };
  const action = body.action === "apply" ? "apply" : body.action === "dismiss" ? "dismiss" : null;
  if (!body.findingId || !action) {
    return NextResponse.json(
      { error: "invalid_request", message: "Pass { findingId, action: 'apply'|'dismiss' }." },
      { status: 400 }
    );
  }
  const result = await applyFinding(brainId, body.findingId, action);
  if (!result.ok) {
    return NextResponse.json({ error: "finding_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, applied: result.applied });
}

import { NextRequest, NextResponse } from "next/server";
import { confirmJob, getJob, serializeJob } from "@/lib/brain/jobs";

export const runtime = "nodejs";

/** POST /api/brain/ingest/[jobId]/confirm — resolve a "needs-review" job.
 *  body: { action: "add" | "discard", nodeId?: string } — nodeId lets the
 *  user override the heuristic placement, forcing every section to one topic. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; nodeId?: string };
  const action = body.action === "discard" ? "discard" : body.action === "add" ? "add" : null;
  if (!action) {
    return NextResponse.json(
      { error: "invalid_action", message: "action must be 'add' or 'discard'." },
      { status: 400 }
    );
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }
  if (job.stage !== "needs-review") {
    return NextResponse.json(
      { error: "not_awaiting_confirmation", stage: job.stage },
      { status: 409 }
    );
  }

  try {
    await confirmJob(jobId, action, typeof body.nodeId === "string" ? body.nodeId : undefined);
  } catch (err) {
    return NextResponse.json(
      { error: "confirm_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json(serializeJob(getJob(jobId)!));
}

import { NextRequest, NextResponse } from "next/server";
import { getJob, serializeJob } from "@/lib/brain/jobs";

export const runtime = "nodejs";

/** GET /api/brain/ingest/[jobId] — poll a single ingest job's progress. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }
  return NextResponse.json(serializeJob(job));
}

import { NextRequest, NextResponse } from "next/server";
import { getBrainId } from "@/lib/brain/id";
import { brainStore } from "@/lib/brain/store";
import { startIngestJob } from "@/lib/brain/jobs";
import { BRAIN_BATCH_LIMIT, BRAIN_MAX_PASSAGES } from "@/lib/rag/config";

export const runtime = "nodejs";

/** POST /api/brain/sources — multipart upload, one job per file. Returns
 *  immediately with job ids; the client polls GET /api/brain/ingest/[jobId].
 *  Per-file cap/type failures surface through that same job-polling path
 *  (extract.ts's own typed failures) rather than being special-cased here —
 *  this route only owns caps extract.ts has no visibility into: how many
 *  files came in one batch, and whether the brain is already full. */
export async function POST(req: NextRequest) {
  const brainId = getBrainId(req.headers);
  if (!brainId) {
    return NextResponse.json({ error: "missing_brain_id" }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no_files", message: "No files were uploaded." }, { status: 400 });
  }
  if (files.length > BRAIN_BATCH_LIMIT) {
    return NextResponse.json(
      {
        error: "batch_too_large",
        message: `Up to ${BRAIN_BATCH_LIMIT} files per upload; you sent ${files.length}.`,
      },
      { status: 413 }
    );
  }

  const manifest = brainStore.loadManifest(brainId);
  const currentPassages = manifest?.counts.passages ?? 0;
  if (currentPassages >= BRAIN_MAX_PASSAGES) {
    return NextResponse.json(
      {
        error: "brain_full",
        message: `Your wiki has ${currentPassages} passages, at the ${BRAIN_MAX_PASSAGES} soft limit. Remove a source before adding more.`,
      },
      { status: 413 }
    );
  }

  const jobs = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const jobId = startIngestJob(brainId, file.name, buffer);
      return { jobId, fileName: file.name };
    })
  );

  return NextResponse.json({ jobs });
}

import { getStore } from "@netlify/blobs";
import { getJob, restoreJob, type JobRecord } from "./jobs";
import { brainStorageMode } from "./persistence";

const STORE_NAME = "equityiq-brains";

type StoredJob = Omit<JobRecord, "pending"> & {
  pending?: Omit<NonNullable<JobRecord["pending"]>, "buffer"> & { buffer: string };
};

function jobKey(jobId: string): string { return `jobs/${jobId}.json`; }

export async function persistJob(jobId: string): Promise<void> {
  if (brainStorageMode !== "netlify-blobs") return;
  const job = getJob(jobId);
  if (!job) return;
  const { pending, ...rest } = job;
  const stored: StoredJob = pending
    ? { ...rest, pending: { ...pending, buffer: pending.buffer.toString("base64") } }
    : rest;
  await getStore(STORE_NAME).setJSON(jobKey(jobId), stored);
}

export async function hydrateJob(jobId: string): Promise<JobRecord | undefined> {
  const local = getJob(jobId);
  if (local || brainStorageMode !== "netlify-blobs") return local;
  const stored = await getStore(STORE_NAME).get(jobKey(jobId), { type: "json", consistency: "strong" }) as StoredJob | null;
  if (!stored) return undefined;
  const { pending, ...rest } = stored;
  const job: JobRecord = pending
    ? { ...rest, pending: { ...pending, buffer: Buffer.from(pending.buffer, "base64") } }
    : rest;
  restoreJob(job);
  return job;
}

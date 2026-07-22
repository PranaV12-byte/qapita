/**
 * Integration — real local embedder, real data/brains/<uuid> directories
 * (gitignored; cleaned up in afterEach). Routes can't reasonably accept an
 * injected fake embedder without leaking internal plumbing into the HTTP
 * contract, so this follows tests/api.test.ts's / retriever-integration's
 * own convention: real model, generous timeouts, not a unit test.
 */
import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { brainStore } from "@/lib/brain/store";
import { getJob, serializeJob, type JobView } from "@/lib/brain/jobs";
import { BRAIN_BATCH_LIMIT, BRAIN_MAX_PASSAGES } from "@/lib/rag/config";

const FIXTURES_GOOD = path.join(process.cwd(), "tests", "fixtures", "brain", "good");
const FIXTURES_PATH = path.join(process.cwd(), "tests", "fixtures", "brain", "pathological");

const createdBrains: string[] = [];
function freshBrainId(): string {
  const id = randomUUID();
  createdBrains.push(id);
  return id;
}
afterEach(() => {
  while (createdBrains.length) brainStore.eraseBrain(createdBrains.pop()!);
});

function headersFor(brainId: string): Headers {
  // Mirrors what middleware.ts forwards — routes read the header, never the
  // raw cookie (a first-time visitor's own request never has one yet).
  const h = new Headers();
  h.set("x-q4np-brain", brainId);
  return h;
}

function uploadReq(brainId: string, files: { name: string; buffer: Buffer }[]): NextRequest {
  const fd = new FormData();
  for (const f of files) {
    fd.append("files", new File([new Uint8Array(f.buffer)], f.name));
  }
  return new NextRequest("http://localhost/api/brain/sources", {
    method: "POST",
    headers: headersFor(brainId),
    body: fd,
  });
}

async function waitForTerminal(jobId: string, timeoutMs = 120_000): Promise<JobView> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = getJob(jobId);
    if (job && (job.stage === "done" || job.stage === "needs-review" || job.stage === "blocked")) {
      return serializeJob(job);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`job ${jobId} never reached a terminal stage within ${timeoutMs}ms`);
}

describe(
  "brain API: happy path job lifecycle",
  () => {
    it("upload -> poll -> reaches a non-blocked terminal stage with real content", async () => {
      const brainId = freshBrainId();
      const { POST } = await import("@/app/api/brain/sources/route");
      const buffer = fs.readFileSync(path.join(FIXTURES_GOOD, "equity-note.md"));
      const res = await POST(uploadReq(brainId, [{ name: "equity-note.md", buffer }]));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { jobs: { jobId: string; fileName: string }[] };
      expect(data.jobs.length).toBe(1);

      const job = await waitForTerminal(data.jobs[0].jobId);
      expect(job.stage).not.toBe("blocked");
      if (job.stage === "done") {
        expect(job.weaveReport?.totalPassages).toBeGreaterThan(0);
      }

      const { GET } = await import("@/app/api/brain/route");
      const manifestRes = await GET(
        new NextRequest("http://localhost/api/brain", { headers: headersFor(brainId) })
      );
      const manifest = await manifestRes.json();
      expect(manifest.brainId).toBe(brainId);
    });
  },
  { timeout: 120_000 }
);

describe(
  "brain API: cap violations return reasons",
  () => {
    it("rejects a batch over BRAIN_BATCH_LIMIT with a clear reason", async () => {
      const brainId = freshBrainId();
      const { POST } = await import("@/app/api/brain/sources/route");
      const buffer = fs.readFileSync(path.join(FIXTURES_GOOD, "equity-note.txt"));
      const files = Array.from({ length: BRAIN_BATCH_LIMIT + 1 }, (_, i) => ({
        name: `file-${i}.txt`,
        buffer,
      }));
      const res = await POST(uploadReq(brainId, files));
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe("batch_too_large");
      expect(data.message).toMatch(new RegExp(String(BRAIN_BATCH_LIMIT)));
    });

    it("rejects an upload when the brain is already at BRAIN_MAX_PASSAGES", async () => {
      const brainId = freshBrainId();
      brainStore.createBrain(brainId);
      const manifest = brainStore.loadManifest(brainId)!;
      manifest.counts.passages = BRAIN_MAX_PASSAGES;
      brainStore.saveManifest(brainId, manifest);

      const { POST } = await import("@/app/api/brain/sources/route");
      const buffer = fs.readFileSync(path.join(FIXTURES_GOOD, "equity-note.txt"));
      const res = await POST(uploadReq(brainId, [{ name: "equity-note.txt", buffer }]));
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe("brain_full");
    });
  },
  { timeout: 60_000 }
);

describe(
  "brain API: confirm/discard both paths",
  () => {
    it("discard: a needs-review job is blocked with no side effects", async () => {
      const brainId = freshBrainId();
      const { POST: upload } = await import("@/app/api/brain/sources/route");
      const buffer = fs.readFileSync(path.join(FIXTURES_PATH, "off-topic.md"));
      const res = await upload(uploadReq(brainId, [{ name: "off-topic.md", buffer }]));
      const { jobs } = (await res.json()) as { jobs: { jobId: string }[] };
      const job = await waitForTerminal(jobs[0].jobId);
      expect(job.stage).toBe("needs-review");

      const { POST: confirm } = await import("@/app/api/brain/ingest/[jobId]/confirm/route");
      const confirmRes = await confirm(
        new NextRequest(`http://localhost/api/brain/ingest/${jobs[0].jobId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "discard" }),
        }),
        { params: Promise.resolve({ jobId: jobs[0].jobId }) }
      );
      expect(confirmRes.status).toBe(200);
      const confirmed = await confirmRes.json();
      expect(confirmed.stage).toBe("blocked");

      const manifest = brainStore.loadManifest(brainId);
      expect(manifest?.counts.sources ?? 0).toBe(0);
    });

    it("add with a chosen topic override: every section lands on that node", async () => {
      const brainId = freshBrainId();
      const { POST: upload } = await import("@/app/api/brain/sources/route");
      const buffer = fs.readFileSync(path.join(FIXTURES_PATH, "off-topic.md"));
      const res = await upload(uploadReq(brainId, [{ name: "off-topic.md", buffer }]));
      const { jobs } = (await res.json()) as { jobs: { jobId: string }[] };
      const job = await waitForTerminal(jobs[0].jobId);
      expect(job.stage).toBe("needs-review");

      const { POST: confirm } = await import("@/app/api/brain/ingest/[jobId]/confirm/route");
      const confirmRes = await confirm(
        new NextRequest(`http://localhost/api/brain/ingest/${jobs[0].jobId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", nodeId: "7.1" }),
        }),
        { params: Promise.resolve({ jobId: jobs[0].jobId }) }
      );
      expect(confirmRes.status).toBe(200);
      const confirmed = await confirmRes.json();
      expect(confirmed.stage).toBe("done");
      expect(confirmed.weaveReport.perNode).toEqual({ "7.1": expect.any(Number) });

      const manifest = brainStore.loadManifest(brainId)!;
      const sourceMeta = Object.values(manifest.sources)[0];
      expect(sourceMeta.nodeIds).toEqual(["7.1"]);
    });
  },
  { timeout: 120_000 }
);

describe(
  "brain API: source removal + erase requires a confirm token",
  () => {
    it("DELETE /api/brain/sources/[sourceId] removes a woven source", async () => {
      const brainId = freshBrainId();
      const { POST: upload } = await import("@/app/api/brain/sources/route");
      const buffer = fs.readFileSync(path.join(FIXTURES_GOOD, "equity-note.md"));
      const res = await upload(uploadReq(brainId, [{ name: "equity-note.md", buffer }]));
      const { jobs } = (await res.json()) as { jobs: { jobId: string }[] };
      let job = await waitForTerminal(jobs[0].jobId);
      if (job.stage === "needs-review") {
        const { POST: confirm } = await import("@/app/api/brain/ingest/[jobId]/confirm/route");
        await confirm(
          new NextRequest(`http://localhost/api/brain/ingest/${jobs[0].jobId}/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add" }),
          }),
          { params: Promise.resolve({ jobId: jobs[0].jobId }) }
        );
        job = serializeJob(getJob(jobs[0].jobId)!);
      }
      expect(job.stage).toBe("done");
      const sourceId = Object.keys(brainStore.loadManifest(brainId)!.sources)[0];

      const { DELETE } = await import("@/app/api/brain/sources/[sourceId]/route");
      const delRes = await DELETE(
        new NextRequest(`http://localhost/api/brain/sources/${sourceId}`, {
          method: "DELETE",
          headers: headersFor(brainId),
        }),
        { params: Promise.resolve({ sourceId }) }
      );
      expect(delRes.status).toBe(200);
      expect(brainStore.loadManifest(brainId)!.sources[sourceId]).toBeUndefined();
    });

    it("erase without confirmBrainId is rejected; with it, the brain is gone", async () => {
      const brainId = freshBrainId();
      brainStore.createBrain(brainId);

      const { DELETE } = await import("@/app/api/brain/route");
      const rejected = await DELETE(
        new NextRequest("http://localhost/api/brain", {
          method: "DELETE",
          headers: { ...Object.fromEntries(headersFor(brainId)), "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(rejected.status).toBe(400);
      expect((await rejected.json()).error).toBe("confirm_required");
      expect(brainStore.brainExists(brainId)).toBe(true);

      const erased = await DELETE(
        new NextRequest("http://localhost/api/brain", {
          method: "DELETE",
          headers: { ...Object.fromEntries(headersFor(brainId)), "Content-Type": "application/json" },
          body: JSON.stringify({ confirmBrainId: brainId }),
        })
      );
      expect(erased.status).toBe(200);
      expect(brainStore.brainExists(brainId)).toBe(false);
    });
  },
  { timeout: 60_000 }
);

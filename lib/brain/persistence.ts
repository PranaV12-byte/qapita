import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { brainStore, isValidBrainId } from "./store";

const STORE_NAME = "equityiq-brains";
const LOCAL_ROOT = path.join(os.tmpdir(), "equityiq-brains");

export const brainStorageMode = process.env.NETLIFY ? "netlify-blobs" : "filesystem";

function keyPrefix(brainId: string): string {
  if (!isValidBrainId(brainId)) throw new Error("Invalid brain id.");
  return `brains/${brainId}/`;
}

function localPath(brainId: string, key: string): string {
  const relative = key.slice(keyPrefix(brainId).length);
  if (!relative || relative.includes("..")) throw new Error("Invalid Brain storage key.");
  return path.join(brainStore.brainPaths(brainId).dir, relative);
}

/** Materializes one anonymous workspace into Lambda's writable /tmp directory. */
export async function hydrateBrain(brainId: string | null): Promise<void> {
  if (!brainId || brainStorageMode !== "netlify-blobs") return;
  const prefix = keyPrefix(brainId);
  const store = getStore(STORE_NAME);
  const listing = await store.list({ prefix, paginate: false });
  for (const blob of listing.blobs) {
    const bytes = await store.get(blob.key, { type: "arrayBuffer", consistency: "strong" });
    if (!bytes) continue;
    const destination = localPath(brainId, blob.key);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(bytes));
  }
}

/** Flushes the local workspace snapshot after a mutation. Files not present locally are removed. */
export async function persistBrain(brainId: string | null): Promise<void> {
  if (!brainId || brainStorageMode !== "netlify-blobs") return;
  const prefix = keyPrefix(brainId);
  const store = getStore(STORE_NAME);
  const root = brainStore.brainPaths(brainId).dir;
  const localKeys = new Set<string>();
  const visit = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) {
        const key = `${prefix}${path.relative(root, fullPath).split(path.sep).join("/")}`;
        localKeys.add(key);
        fs.readFileSync(fullPath);
      }
    }
  };
  visit(root);
  const existing = await store.list({ prefix, paginate: false });
  await Promise.all(existing.blobs.filter((blob) => !localKeys.has(blob.key)).map((blob) => store.delete(blob.key)));
  await Promise.all([...localKeys].map((key) => {
    const bytes = fs.readFileSync(localPath(brainId, key));
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return store.set(key, body);
  }));
}

/** Removes both the local and durable representations of a workspace. */
export async function erasePersistedBrain(brainId: string): Promise<void> {
  if (brainStorageMode !== "netlify-blobs") return;
  const store = getStore(STORE_NAME);
  const listing = await store.list({ prefix: keyPrefix(brainId), paginate: false });
  await Promise.all(listing.blobs.map((blob) => store.delete(blob.key)));
}

export function netlifyBrainRoot(): string {
  return brainStorageMode === "netlify-blobs" ? LOCAL_ROOT : path.join(process.cwd(), "data", "brains");
}

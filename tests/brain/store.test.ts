import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createBrainStore,
  isValidBrainId,
  atomicWriteFileSync,
  BoundedCache,
} from "@/lib/brain/store";

const TEMP_ROOT = path.join(os.tmpdir(), "q4np-brain-store-test");

function freshRoot(): string {
  const dir = path.join(TEMP_ROOT, Math.random().toString(36).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

afterEach(() => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
});

const ID_A = "11111111-2222-3333-4444-555555555555";
const ID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("isValidBrainId", () => {
  it("accepts a well-formed UUID", () => {
    expect(isValidBrainId(ID_A)).toBe(true);
  });

  it("rejects non-UUID strings, including path-traversal attempts", () => {
    expect(isValidBrainId("not-a-uuid")).toBe(false);
    expect(isValidBrainId("../../etc/passwd")).toBe(false);
    expect(isValidBrainId("")).toBe(false);
    expect(isValidBrainId("11111111-2222-3333-4444-55555555555")).toBe(false); // one char short
  });
});

describe("brain store: empty-brain fast path", () => {
  it("brainExists is false and loadManifest is null for an unseen id, with zero disk writes", () => {
    const root = freshRoot();
    const store = createBrainStore(root);
    expect(store.brainExists(ID_A)).toBe(false);
    expect(store.loadManifest(ID_A)).toBeNull();
    // No directory should have been created just by checking.
    expect(fs.existsSync(path.join(root, ID_A))).toBe(false);
  });

  it("rejects invalid brainIds on every entry point", () => {
    const store = createBrainStore(freshRoot());
    expect(() => store.brainPaths("bad-id")).toThrow();
    expect(() => store.brainExists("bad-id")).toThrow();
    expect(() => store.loadManifest("bad-id")).toThrow();
    expect(() => store.createBrain("bad-id")).toThrow();
    expect(() => store.eraseBrain("bad-id")).toThrow();
  });
});

describe("brain store: create / load / erase lifecycle", () => {
  it("creates a brain with a well-formed empty manifest", () => {
    const store = createBrainStore(freshRoot());
    const manifest = store.createBrain(ID_A);
    expect(manifest.brainId).toBe(ID_A);
    expect(manifest.sources).toEqual({});
    expect(manifest.counts).toEqual({ sources: 0, passages: 0 });
    expect(manifest.lint.appendsSinceLint).toBe(0);
    expect(manifest.lint.lastLintAt).toBeNull();
  });

  it("loadManifest returns what createBrain wrote", () => {
    const store = createBrainStore(freshRoot());
    store.createBrain(ID_A);
    const loaded = store.loadManifest(ID_A);
    expect(loaded).not.toBeNull();
    expect(loaded?.brainId).toBe(ID_A);
    expect(store.brainExists(ID_A)).toBe(true);
  });

  it("writes an initial journal.md line on creation", () => {
    const root = freshRoot();
    const store = createBrainStore(root);
    store.createBrain(ID_A);
    const journal = fs.readFileSync(store.brainPaths(ID_A).journalPath, "utf-8");
    expect(journal).toContain("created");
    expect(journal).toContain("## [");
  });

  it("saveManifest persists changes and round-trips", () => {
    const store = createBrainStore(freshRoot());
    const manifest = store.createBrain(ID_A);
    manifest.counts.sources = 3;
    store.saveManifest(ID_A, manifest);
    expect(store.loadManifest(ID_A)?.counts.sources).toBe(3);
  });

  it("eraseBrain removes the whole directory", () => {
    const root = freshRoot();
    const store = createBrainStore(root);
    store.createBrain(ID_A);
    expect(fs.existsSync(store.brainPaths(ID_A).dir)).toBe(true);
    store.eraseBrain(ID_A);
    expect(fs.existsSync(store.brainPaths(ID_A).dir)).toBe(false);
    expect(store.brainExists(ID_A)).toBe(false);
  });

  it("erasing a never-created brain is a harmless no-op", () => {
    const store = createBrainStore(freshRoot());
    expect(() => store.eraseBrain(ID_B)).not.toThrow();
  });
});

describe("atomicWriteFileSync", () => {
  it("writes the given content and creates parent directories", () => {
    const root = freshRoot();
    const target = path.join(root, "nested", "dir", "file.json");
    atomicWriteFileSync(target, JSON.stringify({ ok: true }));
    expect(fs.existsSync(target)).toBe(true);
    expect(JSON.parse(fs.readFileSync(target, "utf-8"))).toEqual({ ok: true });
  });

  it("leaves the destination untouched if rename fails mid-write (no partial write)", () => {
    const root = freshRoot();
    const target = path.join(root, "manifest.json");
    fs.writeFileSync(target, "ORIGINAL");

    const spy = vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("simulated crash between write and rename");
    });

    expect(() => atomicWriteFileSync(target, "NEW-CONTENT")).toThrow(
      "simulated crash"
    );
    // Destination must still hold the OLD content — never truncated/partial.
    expect(fs.readFileSync(target, "utf-8")).toBe("ORIGINAL");

    spy.mockRestore();

    // A second, unpatched write must now succeed normally.
    atomicWriteFileSync(target, "NEW-CONTENT");
    expect(fs.readFileSync(target, "utf-8")).toBe("NEW-CONTENT");
  });

  it("leaves no destination file at all if it never existed and rename fails", () => {
    const root = freshRoot();
    const target = path.join(root, "never-existed.json");

    const spy = vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("simulated crash");
    });
    expect(() => atomicWriteFileSync(target, "X")).toThrow();
    expect(fs.existsSync(target)).toBe(false);
    spy.mockRestore();
  });
});

describe("brain store: per-brain mutex serializes interleaved operations", () => {
  it("runs two concurrent withLock calls on the same brain strictly in order", async () => {
    const store = createBrainStore(freshRoot());
    const log: string[] = [];

    const slow = store.withLock(ID_A, async () => {
      log.push("A-start");
      await new Promise((r) => setTimeout(r, 40));
      log.push("A-end");
    });
    const fast = store.withLock(ID_A, async () => {
      log.push("B-start");
      log.push("B-end");
    });

    await Promise.all([slow, fast]);
    expect(log).toEqual(["A-start", "A-end", "B-start", "B-end"]);
  });

  it("does not serialize operations on different brains", async () => {
    const store = createBrainStore(freshRoot());
    const log: string[] = [];

    const a = store.withLock(ID_A, async () => {
      await new Promise((r) => setTimeout(r, 30));
      log.push("A-done");
    });
    const b = store.withLock(ID_B, async () => {
      log.push("B-done");
    });

    await Promise.all([a, b]);
    // B (a different brain) finishes before A, proving no cross-brain blocking.
    expect(log).toEqual(["B-done", "A-done"]);
  });

  it("a failed operation does not wedge the queue for the next one", async () => {
    const store = createBrainStore(freshRoot());
    await expect(
      store.withLock(ID_A, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const result = await store.withLock(ID_A, async () => "recovered");
    expect(result).toBe("recovered");
  });
});

describe("BoundedCache (LRU)", () => {
  it("evicts the least-recently-used entry once over capacity", () => {
    const cache = new BoundedCache<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3"); // evicts "a"
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
    expect(cache.size).toBe(2);
  });

  it("accessing an entry bumps its recency", () => {
    const cache = new BoundedCache<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a"); // bump "a" to most-recently-used
    cache.set("c", "3"); // should evict "b", not "a"
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
  });

  it("invalidate and clear remove entries", () => {
    const cache = new BoundedCache<string>(5);
    cache.set("a", "1");
    cache.invalidate("a");
    expect(cache.get("a")).toBeUndefined();
    cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe("brain store: saveManifest invalidates the cache", () => {
  it("invalidates the store's cache entry for a brain on save and erase", () => {
    const store = createBrainStore(freshRoot());
    const manifest = store.createBrain(ID_A);
    store.cache.set(ID_A, { some: "state" });
    expect(store.cache.get(ID_A)).toBeDefined();

    store.saveManifest(ID_A, manifest);
    expect(store.cache.get(ID_A)).toBeUndefined();

    store.cache.set(ID_A, { some: "state-2" });
    store.eraseBrain(ID_A);
    expect(store.cache.get(ID_A)).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import path from "node:path";
import os from "node:os";

beforeEach(() => {
  delete process.env.VERCEL;
  delete process.env.ARTIFACT_LOG_PATH;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.VERCEL;
  delete process.env.ARTIFACT_LOG_PATH;
});

describe("logArtifact", () => {
  it("writes valid JSON line to artifact-log.jsonl", async () => {
    const { logArtifact } = await import("@/lib/log");
    const logPath = path.join(process.cwd(), "data", "artifact-log.jsonl");
    const sizeBefore = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

    const result = await logArtifact({ mode: "mock", query: "log-test-query" });

    expect(result.logged).toBe(true);
    expect(fs.existsSync(logPath)).toBe(true);

    const sizeAfter = fs.statSync(logPath).size;
    expect(sizeAfter).toBeGreaterThan(sizeBefore);

    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const lastLine = JSON.parse(lines[lines.length - 1]) as Record<
      string,
      unknown
    >;
    expect(typeof lastLine.ts).toBe("string");
    expect(new Date(lastLine.ts as string).toISOString()).toBe(lastLine.ts);
    expect(lastLine.mode).toBe("mock");
    expect(lastLine.query).toBe("log-test-query");
  });

  it("never throws when file write fails — returns {logged: false}", async () => {
    // Point to a non-existent subdirectory so appendFileSync throws ENOENT
    const impossiblePath = path.join(
      os.tmpdir(),
      "__q4np_nonexistent_dir_12345__",
      "artifact-log.jsonl"
    );
    process.env.ARTIFACT_LOG_PATH = impossiblePath;
    const { logArtifact } = await import("@/lib/log");
    const result = await logArtifact({ mode: "mock", query: "failing-test" });
    expect(result.logged).toBe(false);
  });

  it("uses console.log in Vercel mode instead of writing file", async () => {
    process.env.VERCEL = "1";
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { logArtifact } = await import("@/lib/log");
    const result = await logArtifact({ mode: "mock", query: "vercel-test" });

    expect(result.logged).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    const lastCall =
      consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
    const parsed = JSON.parse(String(lastCall[0])) as Record<string, unknown>;
    expect(typeof parsed.ts).toBe("string");
    expect(parsed.mode).toBe("mock");
    expect(parsed.query).toBe("vercel-test");
  });
});

// V4 (SPEC-VAULT §V4) — the broken-[[link]] lint detector + auto-fix.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBrainStore, type BrainStore } from "@/lib/brain/store";
import { runLint, applyFinding } from "@/lib/brain/lint";

function freshStore(): BrainStore {
  return createBrainStore(fs.mkdtempSync(path.join(os.tmpdir(), "q4np-lint-link-")));
}

const BRAIN = "55555555-5555-5555-5555-555555555555";

describe("lint: broken [[wiki-links]]", () => {
  it("flags a note linking to a title that resolves to nothing, and the fix rewrites only the dead link", async () => {
    const store = freshStore();
    const wikiDir = path.join(store.brainPaths(BRAIN).dir, "wiki");
    fs.mkdirSync(wikiDir, { recursive: true });
    // One resolvable link (a real tree topic) and one broken link.
    fs.writeFileSync(
      path.join(wikiDir, "u-foo.md"),
      "See [[RSU & ESPP tax]] for taxes, and [[Nonexistent Topic]] for the rest."
    );

    const report = await runLint(BRAIN, { store });
    const finding = report.findings.find((f) => f.type === "broken_link");
    expect(finding).toBeTruthy();
    expect(finding!.autoApplicable).toBe(true);
    expect(finding!.message).toContain("Nonexistent Topic");
    expect(finding!.message).not.toContain("RSU & ESPP tax"); // resolvable → not flagged

    const res = await applyFinding(BRAIN, finding!.id, "apply", { store });
    expect(res.applied).toBe(true);

    const after = fs.readFileSync(path.join(wikiDir, "u-foo.md"), "utf-8");
    expect(after).toContain("[[RSU & ESPP tax]]"); // resolvable link kept
    expect(after).not.toContain("[[Nonexistent Topic]]"); // dead link unwrapped
    expect(after).toContain("Nonexistent Topic"); // ...to plain text
  });

  it("does not flag a note whose links all resolve", async () => {
    const store = freshStore();
    const wikiDir = path.join(store.brainPaths(BRAIN).dir, "wiki");
    fs.mkdirSync(wikiDir, { recursive: true });
    fs.writeFileSync(path.join(wikiDir, "3.2.md"), "Related: [[Incentive stock options (ISOs)]].");

    const report = await runLint(BRAIN, { store });
    expect(report.findings.some((f) => f.type === "broken_link")).toBe(false);
  });
});

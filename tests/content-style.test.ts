import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function markdownFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    return entry.isDirectory() ? markdownFiles(fullPath) : entry.name.endsWith(".mdx") ? [fullPath] : [];
  });
}

describe("user-facing content style", () => {
  it("contains no em dashes in Wiki content or generated-answer surfaces", () => {
    const roots = [
      path.join(process.cwd(), "content", "pillars"),
    ];
    const files = roots.flatMap((root) => fs.statSync(root).isDirectory() ? markdownFiles(root) : [root]);
    const llmRoot = path.join(process.cwd(), "lib", "llm");
    files.push(...fs.readdirSync(llmRoot).filter((name) => name.endsWith(".ts")).map((name) => path.join(llmRoot, name)));
    files.push(
      path.join(process.cwd(), "lib", "content", "start-here.ts"),
      path.join(process.cwd(), "components", "brain", "LintPanel.tsx"),
      path.join(process.cwd(), "app", "generate", "client.tsx"),
      path.join(process.cwd(), "components", "knowledge", "KnowledgeCenter.tsx"),
      path.join(process.cwd(), "lib", "pdf", "render.ts"),
    );
    const offenders = files.filter((file) => fs.readFileSync(file, "utf8").includes("\u2014"));
    expect(offenders).toEqual([]);
  });
});

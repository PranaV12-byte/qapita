import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_LOCKUP } from "../lib/brand/lockup";
import { isRedundantArtifactTitle } from "../lib/llm/title";
import { parsePdfBlocks } from "../lib/pdf/markdown";

describe("PDF template renderer", () => {
  it("parses rich Markdown without leaving table or heading syntax", () => {
    const blocks = parsePdfBlocks([
      "## Tax treatment:.",
      "The **spread** matters.",
      "",
      "- Exercise price",
      "- Fair market value",
      "",
      "> A concise callout.",
      "",
      "| Feature | ISOs | NSOs |",
      "| --- | --- | --- |",
      "| Tax | Special | Ordinary |",
    ].join("\n"));

    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "list", "callout", "table"]);
    expect(blocks[0]).toMatchObject({ kind: "heading", text: "Tax treatment" });
    expect(blocks[4]).toMatchObject({ kind: "table", table: { headers: ["Feature", "ISOs", "NSOs"] } });
  });

  it("keeps the reusable PDF template on Letter paper without the removed footer rows", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "lib", "pdf", "template.tsx"), "utf8");
    expect(source).toContain('<Page size="LETTER"');
    expect(source).toContain("fixed");
    expect(source).toContain('footerLogo: { height: BRAND_LOCKUP.pdf.height, objectFit: "contain" as const, opacity: 1 }');
    expect(source).toContain('qapitaFooterLogo: { width: BRAND_LOCKUP.pdf.qapitaWidth }');
    expect(source).toContain('nasppFooterLogo: { width: BRAND_LOCKUP.pdf.nasppWidth, marginLeft: BRAND_LOCKUP.pdf.gap }');
    expect(source).not.toContain('opacity: 0.5');
    expect(source).not.toContain("equityiq.qapita.com");
    expect(source).not.toContain("Reference Guide");
    expect(source).not.toContain("format-badge");
  });

  it("keeps the compact header and footer aligned to one shared PDF lockup", () => {
    expect(BRAND_LOCKUP.pdf).toMatchObject({ height: 30, qapitaWidth: 85, nasppWidth: 87, dividerHeight: 19, gap: 14 });

    const source = fs.readFileSync(path.join(process.cwd(), "lib", "pdf", "template.tsx"), "utf8");
    expect(source).toContain("paddingTop: 82");
    expect(source).toContain("paddingBottom: 102");
    expect(source).toContain("height: 64");
    expect(source).toContain("minHeight: 92");
  });

  it("suppresses a PDF title that only repeats the original question", () => {
    expect(isRedundantArtifactTitle("What is stock appreciation right", "What is stock appreciation right?")).toBe(true);
    expect(isRedundantArtifactTitle("Stock appreciation rights (SARs)", "What is stock appreciation right?")).toBe(false);
  });
});

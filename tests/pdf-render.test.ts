import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_LOCKUP } from "../lib/brand/lockup";
import { isRedundantArtifactTitle } from "../lib/llm/title";
import { parsePdfBlocks } from "../lib/pdf/markdown";
import { PDF_FILENAME } from "../lib/pdf/constants";

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
    expect(source).toContain('size="LETTER" style={[styles.page, { fontFamily }]} wrap>');
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

  it("protects the first question glyph and preserves natural multi-page flow", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "lib", "pdf", "template.tsx"), "utf8");
    const renderer = fs.readFileSync(path.join(process.cwd(), "lib", "pdf", "render.ts"), "utf8");

    expect(source).toContain('questionText: { marginLeft: -1, paddingLeft: 1');
    expect(source).toContain('<Text style={styles.questionText}>{question}</Text>');
    expect(source).toContain('size="LETTER" style={[styles.page, { fontFamily }]} wrap>');
    expect(source).toContain('<View fixed wrap={false} style={styles.header}');
    expect(source).toContain('<View fixed wrap={false} style={styles.footer}');
    expect(source).toContain('render={() => <HeaderContent');
    expect(source).toContain('render={() => <FooterContent');
    expect(source).toContain('orphans={2} widows={2}');
    expect(source).toContain('minPresenceAhead={72}');
    expect(source).not.toContain('paginateProseBlocks');
    expect(source).not.toContain('splitLongParagraph');
    expect(source).not.toContain('Canvas');
    expect(source).toContain('<LinearGradient');
    expect(source).toContain('export function registerPdfFontFamily');
    expect(renderer).toContain('const fontFamily = createRenderFontFamily()');
    expect(renderer).toContain('delete Font.getRegisteredFonts()[fontFamily]');
    expect(renderer).not.toMatch(/slice\([^)]*bodyMarkdown|substring\([^)]*bodyMarkdown/);
    expect(renderer).not.toContain("PdfPageLimitError(");
  });

  it("uses one stable filename for direct downloads, responses, and attachments", () => {
    const client = fs.readFileSync(path.join(process.cwd(), "lib", "artifact", "delivery-client.ts"), "utf8");
    const pdfRoute = fs.readFileSync(path.join(process.cwd(), "app", "api", "artifact", "pdf", "route.ts"), "utf8");
    const deliveryRoute = fs.readFileSync(path.join(process.cwd(), "app", "api", "artifact", "deliver", "route.ts"), "utf8");

    expect(PDF_FILENAME).toBe("EquityIQ Draft Response.pdf");
    expect(client).toContain("link.download = PDF_FILENAME");
    expect(pdfRoute).toContain('filename="${PDF_FILENAME}"');
    expect(pdfRoute).toContain("filename*=UTF-8''${encodeURIComponent(PDF_FILENAME)}");
    expect(deliveryRoute).toContain("filename: PDF_FILENAME");
  });
});

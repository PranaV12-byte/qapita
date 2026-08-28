import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { EquityBriefPDF } from "./template";
import type { Citation } from "@/lib/rag/types";
import type { ComparisonData } from "@/lib/llm/types";
import { normalizeComparison, normalizeGeneratedText } from "@/lib/llm/output-normalizer";
import { ComparisonDataSchema } from "@/lib/llm/comparison";
import { parsePdfBlocks } from "./markdown";
import { BRAND_ASSETS } from "../brand/lockup";
import { normalizeArtifactTitle } from "../llm/title";

export { parsePdfBlocks } from "./markdown";
export type { PdfBlock, PdfTable } from "./markdown";

export type PdfSection = {
  heading?: string;
  paragraphs: string[];
};

/** Kept as a compatibility export for callers that imported the old error.
 * PDFs now flow onto as many Letter pages as the content requires. */
export class PdfPageLimitError extends Error {}

export function extractPdfSections(bodyMarkdown: string): PdfSection[] {
  const sections: PdfSection[] = [];
  let current: PdfSection = { paragraphs: [] };
  const pushCurrent = () => {
    if (current.heading || current.paragraphs.length > 0) sections.push(current);
  };

  for (const block of parsePdfBlocks(bodyMarkdown)) {
    if (block.kind === "heading") {
      pushCurrent();
      current = { heading: block.text, paragraphs: [] };
    } else if (block.kind === "paragraph" || block.kind === "callout") {
      current.paragraphs.push(block.text);
    } else if (block.kind === "list") {
      current.paragraphs.push(...block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`));
    } else {
      current.paragraphs.push(...block.table.rows.map((row) => row.join(" - ")));
    }
  }
  pushCurrent();
  return sections.length > 0 ? sections : [{ paragraphs: [normalizeGeneratedText(bodyMarkdown)] }];
}

function imageDataUrl(fileName: string): string {
  const fullPath = path.join(process.cwd(), "public", "brand", fileName);
  const data = fs.readFileSync(fullPath).toString("base64");
  return `data:image/png;base64,${data}`;
}

export type RenderArtifactPdfInput = {
  title: string;
  bodyMarkdown: string;
  question?: string;
  citations?: Citation[];
  comparison?: ComparisonData;
};

/**
 * The single PDF rendering entry point for direct downloads and email
 * attachments. It accepts older positional calls for compatibility, but always
 * normalizes the result before handing it to the shared React-PDF template.
 */
function normalizeInput(input: RenderArtifactPdfInput): RenderArtifactPdfInput {
  const comparison = input.comparison
    ? ComparisonDataSchema.parse(normalizeComparison(input.comparison))
    : undefined;
  const question = input.question ? normalizeGeneratedText(input.question).trim() : undefined;
  return {
    ...input,
    title: normalizeArtifactTitle(input.title, question || input.title),
    question,
    bodyMarkdown: normalizeGeneratedText(input.bodyMarkdown).trim(),
    comparison,
  };
}

export async function renderArtifactPdf(input: RenderArtifactPdfInput): Promise<Buffer>;
export async function renderArtifactPdf(
  title: string,
  bodyMarkdown: string,
  citations?: Citation[],
  question?: string,
  comparison?: ComparisonData
): Promise<Buffer>;
export async function renderArtifactPdf(
  inputOrTitle: RenderArtifactPdfInput | string,
  bodyMarkdown?: string,
  citations: Citation[] = [],
  question?: string,
  comparison?: ComparisonData
): Promise<Buffer> {
  const input: RenderArtifactPdfInput = typeof inputOrTitle === "string"
    ? { title: inputOrTitle, bodyMarkdown: bodyMarkdown ?? "", citations, question, comparison }
    : inputOrTitle;
  const normalized = normalizeInput(input);
  if (!normalized.title || !normalized.bodyMarkdown) {
    throw new Error("A title and body are required to create a PDF.");
  }

  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return renderToBuffer(
    React.createElement(EquityBriefPDF, {
      title: normalized.title,
      question: normalized.question || normalized.title,
      bodyMarkdown: normalized.bodyMarkdown,
      comparison: normalized.comparison,
      blocks: parsePdfBlocks(normalized.bodyMarkdown),
      date,
      nasppLogoSrc: imageDataUrl(BRAND_ASSETS.naspp),
      qapitaLogoSrc: imageDataUrl(BRAND_ASSETS.qapita),
    })
  );
}

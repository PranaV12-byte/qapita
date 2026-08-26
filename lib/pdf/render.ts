import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { EquityBriefPDF } from "@/lib/pdf/template";
import type { Citation } from "@/lib/rag/types";

export type PdfSection = {
  heading?: string;
  paragraphs: string[];
};

export class PdfPageLimitError extends Error {}

function cleanInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function extractPdfSections(bodyMarkdown: string): PdfSection[] {
  const lines = bodyMarkdown.split(/\r?\n/);
  const sections: PdfSection[] = [];
  let current: PdfSection = { paragraphs: [] };

  const pushCurrent = () => {
    if (current.heading || current.paragraphs.length > 0) sections.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("## ") || line.startsWith("# ")) {
      pushCurrent();
      current = {
        heading: cleanInline(line.replace(/^#{1,2}\s+/, "")),
        paragraphs: [],
      };
      continue;
    }
    const normalized = cleanInline(line.replace(/^\d+\.\s*/, "").replace(/^-\s*/, ""));
    if (normalized) current.paragraphs.push(normalized);
  }
  pushCurrent();

  if (sections.length === 0) {
    return [{ paragraphs: [cleanInline(bodyMarkdown).slice(0, 2200)] }];
  }
  return sections
    .map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs.filter(Boolean).slice(0, 8),
    }))
    .filter((section) => section.heading || section.paragraphs.length > 0)
    .slice(0, 8);
}

function sentenceLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const candidates = text.slice(0, maxChars + 1).match(/[\s\S]*[.!?](?:\s|$)/);
  return (candidates?.[0] ?? text.slice(0, maxChars)).trim();
}

function compactSections(
  sections: PdfSection[],
  citations: Citation[],
  compact: boolean
): PdfSection[] {
  const maxSections = compact ? 3 : 6;
  const maxParagraphs = compact ? 2 : 5;
  const maxChars = compact ? 420 : 760;
  const result = sections.slice(0, maxSections).map((section) => ({
    heading: section.heading,
    paragraphs: section.paragraphs
      .slice(0, maxParagraphs)
      .map((paragraph) => sentenceLimit(paragraph, maxChars)),
  }));
  if (citations.length > 0) {
    result.push({
      heading: "Related topics",
      paragraphs: citations.slice(0, compact ? 4 : 8).map((citation) => citation.title),
    });
  }
  return result;
}

function imageDataUrl(fileName: string): string {
  const fullPath = path.join(process.cwd(), "public", "brand", fileName);
  const data = fs.readFileSync(fullPath).toString("base64");
  return `data:image/png;base64,${data}`;
}

function pageCount(buffer: Buffer): number {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
}

export async function renderArtifactPdf(
  title: string,
  bodyMarkdown: string,
  citations: Citation[] = []
) {
  if (!title.trim() || !bodyMarkdown.trim()) {
    throw new Error("A title and body are required to create a PDF.");
  }
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const sourceSections = extractPdfSections(bodyMarkdown);
  const render = async (compact: boolean) => renderToBuffer(
    React.createElement(EquityBriefPDF, {
      title: sentenceLimit(title.trim(), 160),
      sections: compactSections(sourceSections, citations, compact),
      date,
      nasppLogoSrc: imageDataUrl("naspp-transparent.png"),
      qapitaLogoSrc: imageDataUrl("qapita.png"),
      compact,
    })
  );

  const standard = await render(false);
  if (pageCount(standard) <= 2) return standard;

  const compact = await render(true);
  if (pageCount(compact) <= 2) return compact;
  throw new PdfPageLimitError("The document is too long to fit the two-page PDF format.");
}

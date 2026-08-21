import React from "react";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { EquityBriefPDF } from "@/lib/pdf/template";

export type PdfSection = {
  heading?: string;
  paragraphs: string[];
};

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

export async function renderArtifactPdf(title: string, bodyMarkdown: string) {
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const element = React.createElement(EquityBriefPDF, {
    title,
    sections: extractPdfSections(bodyMarkdown),
    date,
    nasppLogoSrc: path.join(process.cwd(), "public", "brand", "naspp-deep.png"),
    qapitaLogoSrc: path.join(process.cwd(), "public", "brand", "qapita-white-full.png"),
  });
  return renderToBuffer(element);
}

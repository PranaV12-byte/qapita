import { NextRequest, NextResponse } from "next/server";
import React from "react";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { EquityBriefPDF } from "@/lib/pdf/template";

export const runtime = "nodejs";

type PdfSection = {
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

function extractSections(bodyMarkdown: string): PdfSection[] {
  const lines = bodyMarkdown.split(/\r?\n/);
  const sections: PdfSection[] = [];
  let current: PdfSection = { paragraphs: [] };

  const pushCurrent = () => {
    if (current.heading || current.paragraphs.length > 0) {
      sections.push(current);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      pushCurrent();
      current = { heading: cleanInline(line.slice(3)), paragraphs: [] };
      continue;
    }

    if (line.startsWith("# ")) {
      pushCurrent();
      current = { heading: cleanInline(line.slice(2)), paragraphs: [] };
      continue;
    }

    const normalized = cleanInline(
      line
        .replace(/^\d+\.\s*/, "")
        .replace(/^-\s*/, "")
    );

    if (normalized) {
      current.paragraphs.push(normalized);
    }
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    title?: string;
    bodyMarkdown?: string;
    citations?: unknown[];
  };

  const title = String(body.title ?? "Equity Brief");
  const bodyMarkdown = String(body.bodyMarkdown ?? "");
  const sections = extractSections(bodyMarkdown);
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const element = React.createElement(EquityBriefPDF, {
    title,
    sections,
    date,
    nasppLogoSrc: path.join(process.cwd(), "public", "brand", "naspp-deep.png"),
    qapitaLogoSrc: path.join(process.cwd(), "public", "brand", "qapita-white-full.png"),
  });
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="equity-brief.pdf"`,
    },
  });
}

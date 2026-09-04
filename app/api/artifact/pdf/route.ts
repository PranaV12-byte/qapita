import { NextRequest, NextResponse } from "next/server";
import { renderArtifactPdf } from "@/lib/pdf/render";
import { PDF_FILENAME } from "@/lib/pdf/constants";
import { ComparisonDataSchema } from "@/lib/llm/comparison";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Browser-export boundary. The browser sends a result it already received, so
 * every field is validated again before the server renders a document.
 */
const pdfRequestSchema = z.object({
  title: z.string().trim().min(1).max(180),
  question: z.string().trim().min(1).max(4_000).optional(),
  bodyMarkdown: z.string().trim().min(1).max(40_000),
  citations: z.array(z.object({
    kind: z.enum(["topic", "source", "user-node"]).optional(),
    nodeId: z.string().max(200).optional(),
    sourceId: z.string().max(200).optional(),
    title: z.string().min(1).max(300),
  })).max(50).default([]),
  comparison: ComparisonDataSchema.optional(),
});

export async function POST(req: NextRequest) {
  const parsed = pdfRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_pdf_request" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderArtifactPdf({
      title: parsed.data.title,
      question: parsed.data.question,
      bodyMarkdown: parsed.data.bodyMarkdown,
      citations: parsed.data.citations,
      comparison: parsed.data.comparison,
    });
  } catch (error) {
    console.error("PDF generation failed", error);
    return NextResponse.json({ error: "pdf_generation_failed" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${PDF_FILENAME}"; filename*=UTF-8''${encodeURIComponent(PDF_FILENAME)}`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { PdfPageLimitError, renderArtifactPdf } from "@/lib/pdf/render";
import { z } from "zod";

export const runtime = "nodejs";

const pdfRequestSchema = z.object({
  title: z.string().trim().min(1).max(180),
  bodyMarkdown: z.string().trim().min(1).max(40_000),
  citations: z.array(z.object({
    kind: z.enum(["topic", "source", "user-node"]).optional(),
    nodeId: z.string().max(200).optional(),
    sourceId: z.string().max(200).optional(),
    title: z.string().min(1).max(300),
  })).max(50).default([]),
});

export async function POST(req: NextRequest) {
  const parsed = pdfRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_pdf_request" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderArtifactPdf(parsed.data.title, parsed.data.bodyMarkdown, parsed.data.citations);
  } catch (error) {
    const status = error instanceof PdfPageLimitError ? 422 : 500;
    return NextResponse.json({ error: status === 422 ? "pdf_too_long" : "pdf_generation_failed" }, { status });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="equity-brief.pdf"`,
    },
  });
}

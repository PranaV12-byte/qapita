import { NextRequest, NextResponse } from "next/server";
import { renderArtifactPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    title?: string;
    bodyMarkdown?: string;
    citations?: unknown[];
  };

  const title = String(body.title ?? "Equity Brief");
  const bodyMarkdown = String(body.bodyMarkdown ?? "");
  const buffer = await renderArtifactPdf(title, bodyMarkdown);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="equity-brief.pdf"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { EquityBriefPDF } from "@/lib/pdf/template";

export const runtime = "nodejs";

function extractKeyPoints(bodyMarkdown: string): string[] {
  const match = bodyMarkdown.match(
    /##\s*Key\s*points\r?\n([\s\S]*?)(?:\r?\n##|$)/
  );
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .filter((l) => /^\d+\./.test(l.trim()))
    .map((l) => l.replace(/^\d+\.\s*/, "").trim().slice(0, 280))
    .filter((l) => l.length > 0)
    .slice(0, 5);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    title?: string;
    bodyMarkdown?: string;
    citations?: unknown[];
  };

  const title = String(body.title ?? "Equity Brief");
  const bodyMarkdown = String(body.bodyMarkdown ?? "");

  const keyPoints = extractKeyPoints(bodyMarkdown);
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const element = React.createElement(EquityBriefPDF, {
    title,
    keyPoints,
    date,
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

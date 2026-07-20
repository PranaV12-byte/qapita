import { NextRequest, NextResponse } from "next/server";
import { logArtifact } from "@/lib/log";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    artifactId?: string;
    channel?: string;
    email?: string;
  };

  const { channel, email } = body;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const { logged } = await logArtifact({
    format: "deliver",
    deliveredVia: channel ?? "email",
    emailTo: email,
  });

  return NextResponse.json({ ok: true, logged });
}

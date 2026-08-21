import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { auth0, isAuth0Configured } from "@/lib/auth0";
import { buildArtifactEmail } from "@/lib/email/artifact-email";
import { maskEmail } from "@/lib/email/config";
import { logArtifact } from "@/lib/log";
import { renderArtifactPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";

const payloadSchema = z.object({
  artifactId: z.string().min(1).max(100),
  channel: z.literal("email").optional(),
  email: z.string().email().max(320).optional(),
  title: z.string().min(1).max(180),
  bodyMarkdown: z.string().min(1).max(40_000),
  citations: z.array(z.object({
    kind: z.enum(["topic", "source", "user-node"]).optional(),
    nodeId: z.string().max(200).optional(),
    sourceId: z.string().max(200).optional(),
    title: z.string().max(300),
  })).max(50).default([]),
});

export async function POST(req: NextRequest) {
  if (!isAuth0Configured || !auth0) {
    return NextResponse.json({ error: "authentication_not_configured" }, { status: 503 });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_delivery_request" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const mode = process.env.EMAIL_DELIVERY_MODE === "production" ? "production" : "test";
  const recipient = mode === "test" ? process.env.RESEND_TEST_RECIPIENT : parsed.data.email;
  const from = process.env.EMAIL_FROM || "EquityIQ <onboarding@resend.dev>";

  if (!apiKey || !recipient) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }

  try {
    const [pdf, message] = await Promise.all([
      renderArtifactPdf(parsed.data.title, parsed.data.bodyMarkdown),
      Promise.resolve(buildArtifactEmail(parsed.data.title, parsed.data.bodyMarkdown)),
    ]);
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: [recipient],
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
      subject: parsed.data.title,
      html: message.html,
      text: message.text,
      attachments: [
        {
          filename: "equityiq-draft.pdf",
          content: pdf,
        },
      ],
    });

    if (result.error || !result.data?.id) {
      console.error("Resend delivery failed", result.error);
      return NextResponse.json({ error: "email_provider_failed" }, { status: 502 });
    }

    const recipientMasked = maskEmail(recipient);
    const { logged } = await logArtifact({
      format: "deliver",
      deliveredVia: "email",
      emailTo: recipientMasked,
    });

    return NextResponse.json({
      ok: true,
      messageId: result.data.id,
      recipientMasked,
      logged,
    });
  } catch (error) {
    console.error("Artifact email delivery failed", error);
    return NextResponse.json({ error: "email_delivery_failed" }, { status: 502 });
  }
}

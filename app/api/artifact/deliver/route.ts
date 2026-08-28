import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { auth0, isAuth0Configured } from "@/lib/auth0";
import { buildArtifactEmail } from "@/lib/email/artifact-email";
import { getEmailDeliveryConfig, maskEmail } from "@/lib/email/config";
import { logArtifact } from "@/lib/log";
import { renderArtifactPdf } from "@/lib/pdf/render";
import { ComparisonDataSchema } from "@/lib/llm/comparison";

export const runtime = "nodejs";

const payloadSchema = z.object({
  artifactId: z.string().min(1).max(100),
  channel: z.literal("email").optional(),
  email: z.string().email().max(320).optional(),
  title: z.string().min(1).max(180),
  question: z.string().trim().min(1).max(4_000).optional(),
  bodyMarkdown: z.string().min(1).max(40_000),
  citations: z.array(z.object({
    kind: z.enum(["topic", "source", "user-node"]).optional(),
    nodeId: z.string().max(200).optional(),
    sourceId: z.string().max(200).optional(),
    title: z.string().max(300),
  })).max(50).default([]),
  comparison: ComparisonDataSchema.optional(),
});

function deliveryAppUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const safeHost = forwardedHost && /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(forwardedHost)
    ? forwardedHost
    : null;
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : req.nextUrl.protocol.replace(":", "");

  if (safeHost && (protocol === "http" || protocol === "https")) {
    try {
      return new URL("/generate", `${protocol}://${safeHost}`).toString();
    } catch {
      // Invalid proxy metadata falls back to Next.js's validated request URL.
    }
  }
  return new URL("/generate", req.url).toString();
}

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
  const emailConfig = getEmailDeliveryConfig();
  const recipient = emailConfig.mode === "test" ? emailConfig.testRecipient : parsed.data.email;
  const from = process.env.EMAIL_FROM;

  if (!recipient && emailConfig.mode === "production") {
    return NextResponse.json({ error: "recipient_required" }, { status: 400 });
  }
  if (!emailConfig.configured || !apiKey || !recipient || !from) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }

  try {
    const appUrl = deliveryAppUrl(req);
    const [pdf, message] = await Promise.all([
      renderArtifactPdf({
        title: parsed.data.title,
        question: parsed.data.question,
        bodyMarkdown: parsed.data.bodyMarkdown,
        citations: parsed.data.citations,
        comparison: parsed.data.comparison,
      }),
      Promise.resolve(buildArtifactEmail({
        title: parsed.data.title,
        question: parsed.data.question,
        bodyMarkdown: parsed.data.bodyMarkdown,
        comparison: parsed.data.comparison,
        appUrl,
        recipient,
        authenticatedUser: {
          email: session.user.email,
          name: session.user.name,
        },
      })),
    ]);
    const resend = new Resend(apiKey);
    const idempotencyKey = `${session.user.sub ?? session.user.email ?? "user"}:${parsed.data.artifactId}:${recipient}`;
    const result = await resend.emails.send({
      from,
      to: [recipient],
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: [
        {
          filename: "equityiq-draft.pdf",
          content: pdf,
        },
        ...message.inlineAttachments,
      ],
    }, { idempotencyKey });

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

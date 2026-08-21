import { NextResponse } from "next/server";
import { auth0, isAuth0Configured } from "@/lib/auth0";
import { maskEmail } from "@/lib/email/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = auth0 ? await auth0.getSession() : null;
  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        picture: session.user.picture,
      }
    : null;
  const emailMode = process.env.EMAIL_DELIVERY_MODE === "production" ? "production" : "test";
  const testRecipient = process.env.RESEND_TEST_RECIPIENT;

  return NextResponse.json({
    configured: isAuth0Configured,
    user,
    emailMode,
    testRecipientMasked: testRecipient ? maskEmail(testRecipient) : undefined,
  });
}

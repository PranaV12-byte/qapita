import { NextResponse } from "next/server";
import { auth0, isAuth0Configured } from "@/lib/auth0";
import { getEmailDeliveryConfig, maskEmail } from "@/lib/email/config";

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
  const email = getEmailDeliveryConfig();

  const response = NextResponse.json({
    configured: isAuth0Configured,
    user,
    emailMode: email.mode,
    emailConfigured: email.configured,
    testRecipientMasked: email.testRecipient ? maskEmail(email.testRecipient) : undefined,
  });

  return response;
}

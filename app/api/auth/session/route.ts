import { NextRequest, NextResponse } from "next/server";
import { auth0, isAuth0Configured } from "@/lib/auth0";
import { maskEmail } from "@/lib/email/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auth0's middleware refreshes rolling session cookies. It runs here in the
  // Node.js runtime rather than in the Edge middleware.
  const authResponse = auth0 ? await auth0.middleware(request) : null;
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

  const response = NextResponse.json({
    configured: isAuth0Configured,
    user,
    emailMode,
    testRecipientMasked: testRecipient ? maskEmail(testRecipient) : undefined,
  });

  for (const cookie of authResponse?.cookies.getAll() ?? []) {
    response.cookies.set(cookie);
  }

  return response;
}

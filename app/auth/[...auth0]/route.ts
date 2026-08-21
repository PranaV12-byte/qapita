import { NextRequest, NextResponse } from "next/server";
import { auth0, isAuth0Configured } from "@/lib/auth0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleAuthRequest(request: NextRequest) {
  if (!isAuth0Configured || !auth0) {
    return NextResponse.json(
      { error: "authentication_not_configured" },
      { status: 503 }
    );
  }

  // Auth0 v4 mounts login, callback, logout, and profile routes through this
  // handler. Keeping it in Node prevents optional crypto code reaching Edge.
  return auth0.middleware(request);
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;

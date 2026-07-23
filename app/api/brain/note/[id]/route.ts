import { NextRequest, NextResponse } from "next/server";
import { getBrainId } from "@/lib/brain/id";
import { buildNotePage } from "@/lib/brain/wiki";

export const runtime = "nodejs";

/** GET /api/brain/note/[id] — the readable wiki page for one note id
 *  (a curated topic like "3.2", "source:<uuid>", "pillar:<slug>", "general",
 *  or a "u-<slug>" node). Foundation topics/pillars resolve even with no brain
 *  yet; user content requires the caller's brain. 404 for an unknown id. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const brainId = getBrainId(req.headers);
  const { id } = await params;

  const page = await buildNotePage(brainId, decodeURIComponent(id));
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(page);
}

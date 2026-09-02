import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { V9_ACTIVE_SUBTOPICS, V9_TAXONOMY } from "@/lib/content/v9-taxonomy";
import { brainStorageMode } from "@/lib/brain/persistence";
import { getEmailDeliveryConfig } from "@/lib/email/config";

export const runtime = "nodejs";

/** Configuration-only deployment health check. It never returns secret values. */
export async function GET() {
  const manifestPath = path.join(process.cwd(), "data", "index-manifest.json");
  let index: { entryCount?: number; taxonomyVersion?: string } | null = null;
  try { index = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { /* reported below */ }
  const authConfigured = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID && process.env.AUTH0_CLIENT_SECRET && process.env.AUTH0_SECRET);
  const emailConfigured = getEmailDeliveryConfig().configured;
  const generationMode = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  // Netlify can answer from the bundled Wiki without a provider secret. An
  // external key is required only when that provider is explicitly selected.
  const generationConfigured = generationMode !== "groq" || Boolean(process.env.GROQ_API_KEY && process.env.GROQ_MODEL);
  const healthy = Boolean(index && authConfigured && emailConfigured && generationConfigured);
  return NextResponse.json({
    healthy,
    authConfigured,
    emailConfigured,
    generationConfigured,
    generationMode,
    index: index ? { ready: true, entries: index.entryCount ?? 0, taxonomyVersion: index.taxonomyVersion ?? null } : { ready: false, entries: 0, taxonomyVersion: null },
    taxonomy: { groups: V9_TAXONOMY.length, activeTopics: V9_ACTIVE_SUBTOPICS.length },
    brainStorage: brainStorageMode,
  }, { status: healthy ? 200 : 503 });
}

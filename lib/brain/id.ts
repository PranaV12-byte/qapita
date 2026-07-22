// Edge-runtime-safe identity utilities — zero node: imports, so middleware.ts
// (which runs in the Edge runtime, without fs/full Node APIs) can use these.
// lib/brain/store.ts (Node runtime) imports isValidBrainId from here too,
// so the validation rule lives in exactly one place.

export const BRAIN_COOKIE = "q4np-brain";
export const BRAIN_HEADER = "x-q4np-brain";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strict UUID form only — also the defense against path traversal, since a
 *  brainId that fails this can never contain "/", "\", or ".." segments. */
export function isValidBrainId(id: string): boolean {
  return typeof id === "string" && UUID_RE.test(id);
}

/** Reads the brain id middleware forwarded via BRAIN_HEADER, validating it —
 *  never trust the raw header value as a filesystem path component. Every
 *  brain-aware route handler should use this, not req.cookies directly (a
 *  first-time visitor's incoming request never had the cookie in the first
 *  place; middleware.ts guarantees the HEADER is set on matched routes). */
export function getBrainId(headers: Headers): string | null {
  const id = headers.get(BRAIN_HEADER);
  return id && isValidBrainId(id) ? id : null;
}

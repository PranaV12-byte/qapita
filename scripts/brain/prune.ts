import fs from "node:fs";
import path from "node:path";

// ── Retention: prune stale anonymous brains (SPEC-BRAIN.md Phase 5) ─────────────
// Anonymous cookie-scoped brains accumulate as visitors come and go. This
// deletes brain directories untouched for > N days. DRY-RUN BY DEFAULT — pass
// --apply to actually delete. Windows-safe (tsx, node:path, no bash-isms).
//
//   npm run brains:prune                 # dry run, 30-day default
//   npm run brains:prune -- --days 14    # dry run, 14-day cutoff
//   npm run brains:prune -- --days 30 --apply   # actually delete

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv: string[]): { days: number; apply: boolean } {
  let days = 30;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") apply = true;
    else if (argv[i] === "--days") {
      const v = parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(v) && v > 0) days = v;
      i++;
    }
  }
  return { days, apply };
}

/** Most-recent mtime across a brain dir's own files (one level deep is enough —
 *  manifest/journal/answers all live at the top). Represents "last touched". */
function lastTouchedMs(dir: string): number {
  let newest = fs.statSync(dir).mtimeMs;
  for (const entry of fs.readdirSync(dir)) {
    try {
      newest = Math.max(newest, fs.statSync(path.join(dir, entry)).mtimeMs);
    } catch {
      /* ignore races */
    }
  }
  return newest;
}

export function pruneBrains(
  brainsDir: string,
  days: number,
  apply: boolean,
  now: number = Date.now()
): { scanned: number; stale: string[]; deleted: string[] } {
  const stale: string[] = [];
  const deleted: string[] = [];
  if (!fs.existsSync(brainsDir)) return { scanned: 0, stale, deleted };

  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const dirs = fs.readdirSync(brainsDir).filter((name) => UUID_RE.test(name));

  for (const name of dirs) {
    const dir = path.join(brainsDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (lastTouchedMs(dir) < cutoff) {
      stale.push(name);
      if (apply) {
        fs.rmSync(dir, { recursive: true, force: true });
        deleted.push(name);
      }
    }
  }
  return { scanned: dirs.length, stale, deleted };
}

if (require.main === module || process.argv[1]?.endsWith("prune.ts")) {
  const { days, apply } = parseArgs(process.argv.slice(2));
  const brainsDir = path.join(process.cwd(), "data", "brains");
  const { scanned, stale, deleted } = pruneBrains(brainsDir, days, apply);
  console.log(`[prune] scanned ${scanned} brains; ${stale.length} stale (> ${days}d).`);
  if (apply) {
    console.log(`[prune] deleted ${deleted.length}: ${deleted.join(", ") || "(none)"}`);
  } else {
    console.log(`[prune] DRY RUN — would delete: ${stale.join(", ") || "(none)"}. Pass --apply to delete.`);
  }
}

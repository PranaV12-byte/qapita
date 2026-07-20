import fs from "node:fs";
import path from "node:path";

/** Parse one CSV line, honoring double-quoted fields with escaped quotes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"') {
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Turn the reviewed CSV into data/scrape-manifest.json.
 * off-topic rows are dropped (count logged, never silently). general rows keep
 * the "general" sentinel node; node rows carry their assigned nodeId.
 */
export function applyClassification(csvPath: string, outManifest: string): void {
  const lines = fs
    .readFileSync(csvPath, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length === 0) throw new Error(`Empty CSV: ${csvPath}`);

  const header = parseCsvLine(lines[0]);
  const fi = header.indexOf("filePath");
  const di = header.indexOf("disposition");
  const ni = header.indexOf("suggestedNodeId");
  if (fi < 0 || di < 0 || ni < 0) {
    throw new Error("CSV missing required columns (filePath/disposition/suggestedNodeId)");
  }

  const manifest: { filePath: string; nodeId: string }[] = [];
  let offTopic = 0;
  let general = 0;
  let node = 0;

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]);
    const filePath = cols[fi];
    const disposition = (cols[di] ?? "").trim();
    const nodeId = (cols[ni] ?? "").trim();
    if (!filePath) continue;

    if (disposition === "off-topic") {
      offTopic++;
      continue;
    }
    if (disposition === "general") {
      manifest.push({ filePath, nodeId: nodeId || "general" });
      general++;
      continue;
    }
    // "node" (or any disposition carrying an explicit node id)
    if (nodeId) {
      manifest.push({ filePath, nodeId });
      node++;
    } else {
      offTopic++;
    }
  }

  fs.mkdirSync(path.dirname(outManifest), { recursive: true });
  fs.writeFileSync(outManifest, JSON.stringify(manifest, null, 2));
  console.log(
    `[apply] ${manifest.length} files → manifest (node=${node}, general=${general}); ${offTopic} excluded as off-topic`
  );
}

if (
  require.main === module ||
  process.argv[1]?.endsWith("apply-classification.ts")
) {
  const csvPath =
    process.argv[2] ??
    path.join(process.cwd(), "data", "scrape-review", "classification-queue.csv");
  const out =
    process.argv[3] ?? path.join(process.cwd(), "data", "scrape-manifest.json");
  applyClassification(csvPath, out);
}

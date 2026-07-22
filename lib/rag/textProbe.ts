// Moved out of scripts/ingest/classify.ts (which re-exports it) so runtime
// code — lib/brain/healthCheck.ts — can import it directly without pulling
// in classify.ts's fast-glob dependency (a devDependency, wrong to end up in
// a server-runtime bundle). Logic unchanged; classify.ts's own tests still
// cover it via the re-export.

/** First H1 + first paragraph or two — the strongest topic signal per file. */
export function extractTitleAndLead(md: string): { title: string; lead: string } {
  const lines = md.split(/\r?\n/);
  let title = "";
  const paras: string[] = [];
  let buf: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const h1 = line.match(/^#\s+(.+)/);
    if (h1 && !title) {
      title = h1[1].trim();
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      if (buf.length) {
        paras.push(buf.join(" "));
        buf = [];
      }
      continue;
    }
    if (line.trim() === "") {
      if (buf.length) {
        paras.push(buf.join(" "));
        buf = [];
      }
    } else {
      buf.push(line.trim());
    }
    if (paras.length >= 2) break;
  }
  if (buf.length) paras.push(buf.join(" "));

  return { title, lead: paras.slice(0, 2).join(" ").slice(0, 600) };
}

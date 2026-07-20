import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractTitleAndLead } from "@/scripts/ingest/classify";
import { applyClassification } from "@/scripts/ingest/apply-classification";

describe("extractTitleAndLead", () => {
  it("pulls the H1 title and the first paragraphs", () => {
    const md = [
      "# Stock Options 101: The Essentials",
      "",
      "Matt Simon, staff writer",
      "",
      "## Key Points",
      "Stock options give you a potential share in company growth.",
    ].join("\n");
    const { title, lead } = extractTitleAndLead(md);
    expect(title).toBe("Stock Options 101: The Essentials");
    expect(lead.length).toBeGreaterThan(0);
  });

  it("ignores a # inside a code fence", () => {
    const md = ["# Real Title", "```", "# not a title", "```", "Body."].join(
      "\n"
    );
    const { title } = extractTitleAndLead(md);
    expect(title).toBe("Real Title");
  });
});

describe("applyClassification", () => {
  it("keeps node + general rows, drops off-topic, into a manifest", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "q4np-classify-"));
    const csvPath = path.join(dir, "queue.csv");
    const outPath = path.join(dir, "scrape-manifest.json");

    const csv = [
      "filePath,disposition,suggestedNodeId,suggestedNodeTitle,confidence,secondBestNodeId,secondBestConfidence,flaggedChunks",
      "/kb/a.md,node,3.2,RSU & ESPP tax,0.71,1.3,0.55,",
      "/kb/b.md,general,general,General equity compensation,0.38,3.1,0.34,",
      "/kb/c.md,off-topic,,,0.12,6.1,0.10,",
      // quoted title containing a comma must not break parsing
      '"/kb/d,weird.md",node,1.1,"ISOs, incentive options",0.66,1.2,0.60,ambiguous',
    ].join("\n");
    fs.writeFileSync(csvPath, csv);

    applyClassification(csvPath, outPath);

    const manifest = JSON.parse(fs.readFileSync(outPath, "utf-8")) as {
      filePath: string;
      nodeId: string;
    }[];
    expect(manifest.length).toBe(3); // off-topic dropped
    const byPath = Object.fromEntries(manifest.map((m) => [m.filePath, m.nodeId]));
    expect(byPath["/kb/a.md"]).toBe("3.2");
    expect(byPath["/kb/b.md"]).toBe("general");
    expect(byPath["/kb/d,weird.md"]).toBe("1.1");
    expect(byPath["/kb/c.md"]).toBeUndefined();
  });
});

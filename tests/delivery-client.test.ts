import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverArtifactEmail, downloadArtifactPdf } from "../lib/artifact/delivery-client";

const artifact = {
  artifactId: "artifact-1",
  title: "ISO and NSO comparison",
  question: "Compare ISOs and NSOs for an employee planning discussion.",
  bodyMarkdown: "## Comparison\n\nThe award terms differ.",
  citations: [{ nodeId: "1.1", title: "ISOs" }],
  comparison: {
    title: "ISO and NSO comparison",
    subtitle: "A concise comparison.",
    columns: ["ISOs", "NSOs"],
    rows: [{ feature: "Tax", values: ["Special treatment may apply.", "Ordinary income may apply."] }],
    takeaway: "Review the award terms and timing.",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("artifact delivery payloads", () => {
  it("keeps the complete question and comparison for PDF delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["pdf"]), { status: 200, headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:pdf"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({ href: "", download: "", click: vi.fn(), remove: vi.fn() })),
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("window", { setTimeout: vi.fn() });

    await downloadArtifactPdf(artifact);

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.question).toBe(artifact.question);
    expect(payload.comparison).toEqual(artifact.comparison);
  });

  it("keeps the complete question and comparison for email delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, recipientMasked: "pr***@example.com" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await deliverArtifactEmail(artifact, "pranav@example.com");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(result.recipientMasked).toBe("pr***@example.com");
    expect(payload.question).toBe(artifact.question);
    expect(payload.comparison).toEqual(artifact.comparison);
  });
});

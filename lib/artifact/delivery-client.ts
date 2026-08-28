import type { ComparisonData } from "@/lib/llm/types";

export type DeliveryCitation = {
  kind?: "topic" | "source" | "user-node";
  nodeId?: string;
  sourceId?: string;
  title: string;
};

export type DeliveryArtifact = {
  artifactId: string;
  title: string;
  bodyMarkdown: string;
  citations: DeliveryCitation[];
  question?: string;
  comparison?: ComparisonData;
};

export async function downloadArtifactPdf(artifact: DeliveryArtifact): Promise<void> {
  const response = await fetch("/api/artifact/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: artifact.title,
      question: artifact.question,
      bodyMarkdown: artifact.bodyMarkdown,
      citations: artifact.citations,
      comparison: artifact.comparison,
    }),
  });
  if (!response.ok) throw new Error("pdf_failed");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "equityiq-draft.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverArtifactEmail(
  artifact: DeliveryArtifact,
  email?: string
): Promise<{ recipientMasked?: string }> {
  const response = await fetch("/api/artifact/deliver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      artifactId: artifact.artifactId,
      channel: "email",
      email: email || undefined,
      title: artifact.title,
      question: artifact.question,
      bodyMarkdown: artifact.bodyMarkdown,
      citations: artifact.citations,
      comparison: artifact.comparison,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    recipientMasked?: string;
    error?: string;
  };
  if (!response.ok) throw new Error(result.error || "email_delivery_failed");
  return result;
}

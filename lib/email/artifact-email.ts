import { extractPdfSections } from "@/lib/pdf/render";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

export function buildArtifactEmail(title: string, bodyMarkdown: string) {
  const sections = extractPdfSections(bodyMarkdown);
  const contentHtml = sections
    .map((section) => `
      <section style="margin:0 0 24px">
        ${section.heading ? `<h2 style="margin:0 0 10px;color:#633EA5;font-size:17px;line-height:1.4">${escapeHtml(section.heading)}</h2>` : ""}
        ${section.paragraphs.map((paragraph) => `<p style="margin:0 0 10px;color:#372B4F;font-size:15px;line-height:1.7">${escapeHtml(paragraph)}</p>`).join("")}
      </section>`)
    .join("");
  const text = [
    title,
    "",
    ...sections.flatMap((section) => [section.heading || "", ...section.paragraphs, ""]),
    "Prepared in EquityIQ. Review final wording and approval requirements before distribution.",
  ].join("\n");

  return {
    text,
    html: `<!doctype html><html><body style="margin:0;background:#F7F5FB;font-family:Arial,sans-serif;color:#372B4F">
      <div style="padding:32px 16px">
        <div style="max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #E5DCF6;border-radius:18px;overflow:hidden">
          <div style="padding:28px 32px;background:#633EA5">
            <div style="color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">EquityIQ</div>
          </div>
          <div style="padding:32px">
            <h1 style="margin:0 0 28px;color:#241A34;font-size:28px;line-height:1.3">${escapeHtml(title)}</h1>
            ${contentHtml}
          </div>
          <div style="padding:18px 32px;background:#F4EFFD;color:#6C6283;font-size:12px;line-height:1.6">
            Prepared in EquityIQ. Review final wording and approval requirements before distribution.
          </div>
        </div>
      </div>
    </body></html>`,
  };
}

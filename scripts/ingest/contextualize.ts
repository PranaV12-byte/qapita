import { CONTEXTUAL_ENRICHMENT } from "../../lib/rag/config";

/** Compose the string that gets embedded: doc title + heading path + chunk text. */
function joinContext(
  title: string | undefined,
  headingPath: string | undefined,
  text: string
): string {
  return [title, headingPath, text].filter(Boolean).join(" — ");
}

/**
 * Optional LLM situating context (Anthropic-style contextual retrieval).
 * Off by default. When on and a Groq key is present, asks for one short sentence
 * placing the chunk in its document; returns "" on any failure so ingest never
 * breaks. This is an OFFLINE ingest concern only — runtime never needs a key.
 */
async function llmContext(
  title: string,
  headingPath: string,
  text: string
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
          temperature: 0,
          max_tokens: 60,
          messages: [
            {
              role: "system",
              content:
                "Write one short sentence situating the chunk within its document to improve search retrieval. Output only the sentence.",
            },
            {
              role: "user",
              content: `Document: ${title}\nSection: ${headingPath}\nChunk:\n${text}`,
            },
          ],
        }),
      }
    );
    if (!res.ok) return "";
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}

/** Build the final embed-input string for a chunk (enrichment applied if enabled). */
export async function buildEmbedInput(
  title: string | undefined,
  headingPath: string | undefined,
  text: string
): Promise<string> {
  const base = joinContext(title, headingPath, text);
  if (!CONTEXTUAL_ENRICHMENT) return base;
  const ctx = await llmContext(title ?? "", headingPath ?? "", text);
  return ctx ? `${ctx} — ${base}` : base;
}

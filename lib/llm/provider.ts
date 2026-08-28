export type { ArtifactResult, LLMProvider } from "./types";

import type { LLMProvider } from "./types";
import { MockLLM } from "./mock";
import { GroqProvider } from "./groq";
import { AnthropicProvider } from "./anthropic";

/**
 * Selects the configured provider for a request. Mock is intentional rather
 * than an error path: it keeps local development and provider outages on the
 * same structured artifact contract.
 */
export function getLLMProvider(): LLMProvider {
  const p = process.env.LLM_PROVIDER;
  if (p === "groq") return new GroqProvider();
  if (p === "anthropic") return new AnthropicProvider();
  return new MockLLM();
}

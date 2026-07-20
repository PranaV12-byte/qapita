export type { ArtifactResult, LLMProvider } from "./types";

import type { LLMProvider } from "./types";
import { MockLLM } from "./mock";
import { GroqProvider } from "./groq";
import { AnthropicProvider } from "./anthropic";

export function getLLMProvider(): LLMProvider {
  const p = process.env.LLM_PROVIDER;
  if (p === "groq") return new GroqProvider();
  if (p === "anthropic") return new AnthropicProvider();
  return new MockLLM();
}

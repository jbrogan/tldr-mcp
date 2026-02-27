import type { LLMProvider, LLMProviderType } from "./types.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOpenAIProvider } from "./openai.js";

function getProviderFromEnv(): LLMProviderType {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();
  if (provider === "openai") return "openai";
  return "anthropic"; // default
}

export function createLLMProvider(): LLMProvider {
  const providerType = getProviderFromEnv();
  const modelRaw = process.env.LLM_MODEL?.trim();
  const model = modelRaw && modelRaw.length > 0 ? modelRaw : undefined;

  if (providerType === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic. Set it in your environment or .env file."
      );
    }
    return createAnthropicProvider(apiKey, model);
  }

  if (providerType === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when LLM_PROVIDER=openai. Set it in your environment or .env file."
      );
    }
    return createOpenAIProvider(apiKey, model);
  }

  throw new Error(`Unknown LLM_PROVIDER: ${providerType}`);
}

/**
 * LLM provider interface for natural language interpretation.
 */
export interface LLMProvider {
  complete(prompt: string): Promise<string>;
}

export type LLMProviderType = "anthropic" | "openai";

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./types.js";

export function createAnthropicProvider(apiKey: string, model?: string): LLMProvider {
  const client = new Anthropic({ apiKey });
  const modelId = model ?? "claude-3-5-haiku-20241022";

  return {
    async complete(prompt: string): Promise<string> {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text in Anthropic response");
      }
      return textBlock.text;
    },
  };
}

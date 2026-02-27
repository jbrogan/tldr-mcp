import OpenAI from "openai";
import type { LLMProvider } from "./types.js";

export function createOpenAIProvider(apiKey: string, model?: string): LLMProvider {
  const client = new OpenAI({ apiKey });
  const modelId = model ?? "gpt-4o-mini";

  return {
    async complete(prompt: string): Promise<string> {
      const response = await client.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }
      return content;
    },
  };
}

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiDraftSchema, type DraftInput, type DraftProvider, type DraftResult } from "./types";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";

export class AnthropicDraftProvider implements DraftProvider {
  readonly name = "anthropic";
  private client = new Anthropic();
  constructor(private model = process.env.AI_MODEL || "claude-opus-5-5") {}

  async draft(input: DraftInput): Promise<DraftResult> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // If the primary model declines, the API retries on a fallback model it picks.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(aiDraftSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(input) }],
    });
    if (response.stop_reason === "refusal") throw new Error("The AI model declined to draft this story. Write the draft manually.");
    if (response.stop_reason === "max_tokens") throw new Error("The AI draft was cut off. Try with less source material.");
    const draft = response.parsed_output;
    if (!draft) throw new Error("The AI returned a draft in an unexpected format");
    return {
      draft,
      model: response.model,
      provider: this.name,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}

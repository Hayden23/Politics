import { z } from "zod";

/** What the model is asked to return. Every field is a suggestion for a human editor. */
export const aiDraftSchema = z.object({
  headline: z.string().describe("Neutral, source-blind headline under 120 characters. No publisher names."),
  briefing: z.string().describe("100-250 word plain-language briefing in short paragraphs separated by blank lines. Attribute claims to who made them."),
  keyFacts: z.array(z.object({ text: z.string(), sourceRefs: z.array(z.number()) })).describe("Verifiable facts, each tied to the numbered source material it comes from."),
  disputedClaims: z.array(z.object({ text: z.string(), sourceRefs: z.array(z.number()) })).describe("Claims made by a party that are contested or unverified, attributed."),
  uncertainties: z.array(z.object({ text: z.string(), sourceRefs: z.array(z.number()) })).describe("What is not yet known or still undecided."),
  questionSuggestions: z.array(z.string()).describe("1-3 neutral support/oppose questions ending in '?'."),
  loadedWording: z.array(z.object({ phrase: z.string(), suggestion: z.string() })).describe("Loaded or partisan wording found in the source material and neutral alternatives."),
  needsVerification: z.array(z.string()).describe("Claims an editor must verify before publication."),
  missingContext: z.array(z.string()).describe("Context a fair reader would need that the material lacks."),
});
export type AiDraft = z.infer<typeof aiDraftSchema>;

export type DraftInput = {
  topic: string | null;
  editorNotes: string;
  /** Numbered material the editor supplied or is licensed to use. Nothing else may be used. */
  material: { ref: number; publisher: string; url: string | null; text: string }[];
};

export type DraftResult = { draft: AiDraft; model: string; provider: string; usage: { inputTokens: number; outputTokens: number } };

export interface DraftProvider {
  readonly name: string;
  draft(input: DraftInput): Promise<DraftResult>;
}

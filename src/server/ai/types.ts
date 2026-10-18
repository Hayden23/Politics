import { z } from "zod";

/** What the model is asked to return. Every field is a suggestion for a human editor. */
export const aiDraftSchema = z.object({
  headline: z.string().describe("Neutral, source-blind headline under 120 characters. No publisher names."),
  briefing: z.string().describe("100-250 word plain-language briefing in short paragraphs separated by blank lines. Attribute claims to who made them."),
  keyFacts: z.array(z.object({ text: z.string(), sourceRefs: z.array(z.number()) })).describe("Verifiable facts, each tied to the numbered source material it comes from."),
  disputedClaims: z.array(z.object({ text: z.string(), sourceRefs: z.array(z.number()) })).describe("Claims made by a party that are contested or unverified, attributed."),
  uncertainties: z.array(z.object({ text: z.string(), sourceRefs: z.array(z.number()) })).describe("What is not yet known or still undecided."),
  perspectives: z
    .array(
      z.object({
        side: z.enum(["left", "right"]),
        summary: z.string().describe("How this side describes the issue and its position, attributed, in its own best terms."),
        arguments: z.array(z.object({ text: z.string(), sourceRefs: z.array(z.number()) })).describe("That side's strongest arguments, steelmanned, each tied to source material."),
        framing: z.string().describe("Words and framing this side tends to use for the issue."),
        values: z.array(z.string()).describe("1-4 values this side emphasizes, e.g. liberty, fairness, security."),
      }),
    )
    .describe("Exactly two entries — left then right — of equal depth and charity. Leave arguments empty rather than inventing them if the material lacks a side's view."),
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
  checkBalance(input: BalanceInput): Promise<{ result: AiBalance; model: string; usage: { inputTokens: number; outputTokens: number } }>;
}

export const aiBalanceSchema = z.object({
  issues: z.array(
    z.object({
      kind: z.enum(["loaded_language", "one_sided", "missing_context", "unattributed_claim", "asymmetry", "factual_risk", "source_leak"]),
      excerpt: z.string().describe("Exact short quote from the draft, or empty"),
      detail: z.string(),
      suggestion: z.string(),
    }),
  ),
});
export type AiBalance = z.infer<typeof aiBalanceSchema>;

export type BalanceInput = { headline: string; briefing: string; keyFacts: string[]; disputedClaims: string[]; perspectives: { side: string; summary: string; arguments: string[]; framing: string }[]; question: string | null };

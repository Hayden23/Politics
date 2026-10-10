import type { DraftInput, DraftProvider, DraftResult } from "./types";

/**
 * Deterministic stand-in used by automated tests. Its output is visibly
 * marked so it can never be mistaken for real editorial content.
 */
export class MockDraftProvider implements DraftProvider {
  readonly name = "mock";
  async draft(input: DraftInput): Promise<DraftResult> {
    const first = input.material[0]?.text.split(/\s+/).slice(0, 40).join(" ") ?? "";
    return {
      model: "mock",
      provider: this.name,
      usage: { inputTokens: 0, outputTokens: 0 },
      draft: {
        headline: "[MOCK AI DRAFT] Summary of supplied material",
        briefing: `[MOCK AI DRAFT — not real content] ${first}`,
        keyFacts: input.material.map((m) => ({ text: `[MOCK] Fact drawn from material ${m.ref}`, sourceRefs: [m.ref] })),
        disputedClaims: [],
        uncertainties: [{ text: "[MOCK] Uncertainty placeholder", sourceRefs: [] }],
        questionSuggestions: ["[MOCK] Do you support the proposal described above?"],
        loadedWording: [],
        needsVerification: ["[MOCK] Verify every claim against the source"],
        missingContext: [],
      },
    };
  }
}

import type { BalanceInput, DraftInput, DraftProvider, DraftResult } from "./types";

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
        perspectives: (["left", "right"] as const).map((side) => ({ side, summary: `[MOCK] How the ${side} sees it`, arguments: [{ text: `[MOCK] ${side} argument`, sourceRefs: [1] }], framing: "[MOCK] framing", values: ["[MOCK]"] })),
        questionSuggestions: ["[MOCK] Do you support the proposal described above?"],
        loadedWording: [],
        needsVerification: ["[MOCK] Verify every claim against the source"],
        missingContext: [],
      },
    };
  }

  async checkBalance(input: BalanceInput) {
    return { model: "mock", usage: { inputTokens: 0, outputTokens: 0 }, result: { issues: input.briefing.includes("radical") ? [{ kind: "loaded_language" as const, excerpt: "radical", detail: "[MOCK] loaded term", suggestion: "[MOCK] neutral wording" }] : [] } };
  }
}

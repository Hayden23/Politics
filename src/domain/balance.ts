import type { BalanceCheck, Perspective } from "@/server/db/schema";

/**
 * Deterministic balance heuristics that run without AI: loaded vocabulary,
 * unattributed contested verbs, and asymmetry between the left and right
 * perspectives. These are prompts for an editor, not verdicts.
 */
export const LOADED_TERMS = [
  "radical", "extremist", "far-left", "far-right", "socialist agenda", "woke", "fascist", "un-american",
  "slammed", "blasted", "destroyed", "eviscerated", "shocking", "outrageous", "disastrous", "draconian",
  "job-killing", "common-sense", "so-called", "regime", "illegals", "pro-abortion", "anti-choice",
  "death tax", "gun-grabbing", "assault weapon ban", "handout", "giveaway", "scheme", "crusade",
] as const;

const UNATTRIBUTED = /\b(proves?|debunked|lied|admitted|exposed)\b/i;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function heuristicBalanceCheck(input: { headline: string; briefing: string; perspectives: Perspective[] }): BalanceCheck {
  const issues: BalanceCheck["issues"] = [];
  const text = `${input.headline}\n${input.briefing}`;
  for (const term of LOADED_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[-]/g, "[- ]")}\\b`, "i");
    const m = text.match(re);
    if (m) issues.push({ kind: "loaded_language", excerpt: m[0], detail: `“${m[0]}” is commonly read as partisan or emotive`, suggestion: "Use neutral, descriptive wording or attribute the term to whoever used it" });
  }
  for (const sentence of input.briefing.split(/(?<=[.!?])\s+/)) {
    if (UNATTRIBUTED.test(sentence) && !/\b(said|says|according to|argued|claimed|told)\b/i.test(sentence)) {
      issues.push({ kind: "unattributed_claim", excerpt: sentence.slice(0, 160), detail: "Contested verb without attribution", suggestion: "Say who makes this claim" });
    }
  }
  const left = input.perspectives.find((p) => p.side === "left");
  const right = input.perspectives.find((p) => p.side === "right");
  const stats: Record<string, number> = { briefingWords: words(input.briefing) };
  if (left && right) {
    const lw = words([left.summary, ...left.arguments.map((a) => a.text), left.framing].join(" "));
    const rw = words([right.summary, ...right.arguments.map((a) => a.text), right.framing].join(" "));
    stats.leftWords = lw;
    stats.rightWords = rw;
    stats.leftArguments = left.arguments.length;
    stats.rightArguments = right.arguments.length;
    const ratio = Math.max(lw, rw) / Math.max(1, Math.min(lw, rw));
    if (ratio > 1.5) issues.push({ kind: "asymmetry", detail: `The ${lw > rw ? "left" : "right"} perspective is ${ratio.toFixed(1)}× longer than the other`, suggestion: "Give each side comparable space and its strongest arguments" });
    if (Math.abs(left.arguments.length - right.arguments.length) > 1) issues.push({ kind: "asymmetry", detail: `Argument counts differ (${left.arguments.length} left vs ${right.arguments.length} right)` });
    const uncited = [...left.arguments, ...right.arguments].filter((a) => !a.sourceIds?.length).length;
    if (uncited) issues.push({ kind: "uncited_argument", detail: `${uncited} perspective argument${uncited === 1 ? " has" : "s have"} no linked source`, suggestion: "Link each argument to the coverage it comes from" });
  } else if (left || right) {
    issues.push({ kind: "missing_perspective", detail: `Only the ${left ? "left" : "right"} perspective is written` });
  }
  return { checkedAt: new Date().toISOString(), by: "heuristic", issues, stats };
}

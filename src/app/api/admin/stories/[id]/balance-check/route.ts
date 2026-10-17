import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { getForEditor, saveBalanceCheck } from "@/server/services/editorial";
import { heuristicBalanceCheck } from "@/domain/balance";
import { aiBalanceCheck } from "@/server/ai";
import { rateLimit } from "@/server/services/rateLimit";
import type { BalanceCheck } from "@/server/db/schema";

/** Runs the heuristic balance check, and optionally an AI review on top. Saves the result on the working version. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  const { ai } = await body(req, z.object({ ai: z.boolean().default(false) }));
  const { story, questions } = await getForEditor(z.string().uuid().parse(id));
  const heuristic = heuristicBalanceCheck({ headline: story.headline, briefing: story.briefing, perspectives: story.perspectives });
  let check: BalanceCheck = heuristic;
  if (ai) {
    await rateLimit("ai", actor.id);
    const q = questions.at(-1);
    const r = await aiBalanceCheck({
      headline: story.headline,
      briefing: story.briefing,
      keyFacts: story.keyFacts.map((f) => f.text),
      disputedClaims: story.disputedClaims.map((f) => f.text),
      perspectives: story.perspectives.map((p) => ({ side: p.side, summary: p.summary, arguments: p.arguments.map((a) => a.text), framing: p.framing })),
      question: q?.questionText ?? null,
    });
    check = { checkedAt: new Date().toISOString(), by: "ai", model: r.model, issues: [...heuristic.issues, ...r.result.issues], stats: heuristic.stats };
  }
  await saveBalanceCheck(actor, story.id, check);
  return { check };
});

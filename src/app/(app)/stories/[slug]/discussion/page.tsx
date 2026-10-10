import Link from "next/link";
import { getActor } from "@/server/auth/session";
import { getResults } from "@/server/services/reader";
import { listComments, EDIT_WINDOW_HOURS, type Perspective } from "@/server/services/community";
import { canPost } from "@/server/auth/roles";
import { gated } from "@/lib/gate";
import { BackLink, StoryNav } from "@/components/StoryNav";
import { GroupedBar } from "@/components/GroupedBar";
import { Card, Empty, Notice } from "@/components/ui";
import { responseLabel } from "@/domain/scale";
import { formatDate } from "@/lib/format";
import { PerspectiveChips, type PerspectiveKey } from "./PerspectiveChips";
import { Discussion } from "./Discussion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Perspectives" };

const PERSPECTIVES: PerspectiveKey[] = ["all", "different", "insightful", "newest"];

const EMPTY: Record<PerspectiveKey, { title: string; body: string }> = {
  all: { title: "No explanations yet", body: "Be the first to share the main reason behind your position." },
  different: {
    title: "No different responses to show",
    body: "This filter only includes people who chose to show their answer next to their comments and whose answer leans the other way from yours (or is neutral when yours isn't). It's empty if no one like that has commented yet, or if your own answer was “don't know”.",
  },
  insightful: { title: "Nothing marked insightful yet", body: "When readers mark an explanation as insightful, it shows up here." },
  newest: { title: "No explanations yet", body: "Be the first to share the main reason behind your position." },
};

export default async function DiscussionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ perspective?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const perspective: PerspectiveKey = PERSPECTIVES.includes(sp.perspective as PerspectiveKey) ? (sp.perspective as PerspectiveKey) : "all";
  const actor = await getActor();
  const r = await gated(slug, () => getResults(slug, actor));
  const current = r.results[0];

  if (!current) {
    return (
      <div>
        <BackLink href={`/stories/${slug}`}>Briefing</BackLink>
        <h1 className="font-serif text-2xl font-semibold leading-snug">{r.headline}</h1>
        <div className="mt-4"><StoryNav slug={slug} current="discussion" /></div>
        <Empty title="No discussion yet">This briefing doesn't have a published question.</Empty>
      </div>
    );
  }

  const data = await gated(slug, () => listComments(actor, current.question.id, perspective as Perspective));
  const mine = r.myRatings.find((m) => m.questionId === current.question.id) ?? null;
  const closed = current.question.status === "retired";
  const posting = actor ? canPost(actor) : false;

  return (
    <div>
      <BackLink href={`/stories/${slug}`}>Briefing</BackLink>
      <h1 className="font-serif text-2xl font-semibold leading-snug">{r.headline}</h1>
      <div className="mt-4"><StoryNav slug={slug} current="discussion" /></div>

      <Card className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">The question</p>
        <h2 className="mt-1 font-serif text-xl font-semibold leading-snug">{current.question.text}</h2>
        {mine && (
          <p className="mt-2 text-sm text-ink-2">
            You answered: <span className="font-semibold text-ink">{responseLabel(current.question.scale, mine.type, mine.value)}</span>
          </p>
        )}
        <div className="mt-4">
          <GroupedBar dist={current.distribution} scale={current.question.scale} />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {current.population} · {current.weighting} · <Link href={`/stories/${slug}/results`} className="underline">Full results</Link>
        </p>
      </Card>

      <section aria-labelledby="perspectives">
        <h2 id="perspectives" className="text-lg font-semibold">Explore perspectives</h2>
        <p className="mt-1 text-sm text-ink-2">Read the reasons behind people's answers. Engage with the argument, not the person.</p>
        <div className="mt-3">
          <PerspectiveChips slug={slug} storyId={r.storyId} current={perspective} />
        </div>
        <p id="perspective-help" className="mt-2 text-xs text-ink-3">
          “Different responses” only includes people who chose to share their answer alongside their comments. Everyone else's answer stays private.
        </p>

        {!mine && (
          <Notice className="mt-4">
            You answered an earlier version of this question. You can read the discussion; <Link href={`/stories/${slug}`} className="underline">answer the current wording</Link> to see whose answers differ from yours.
          </Notice>
        )}
        {closed && <Notice className="mt-4">This discussion is closed because editors revised the question.</Notice>}

        <Discussion
          key={perspective}
          questionId={current.question.id}
          storyId={r.storyId}
          comments={data.comments}
          signedIn={!!actor}
          canPost={posting && !closed}
          closed={closed}
          restrictedUntil={actor && !posting && actor.restrictedUntil ? formatDate(actor.restrictedUntil, { month: "long", day: "numeric", year: "numeric" }) : null}
          editWindowHours={EDIT_WINDOW_HOURS}
          empty={EMPTY[perspective]}
        />
      </section>
    </div>
  );
}

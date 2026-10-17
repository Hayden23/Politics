import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getBriefing } from "@/server/services/reader";
import { HttpError } from "@/lib/errors";
import { track } from "@/server/services/analytics";
import { RatingForm } from "@/components/RatingForm";
import { BookmarkButton, ReportButton, ShareButton } from "@/components/StoryActions";
import { BackLink } from "@/components/StoryNav";
import { BriefingBody } from "@/components/BriefingBody";
import { Notice } from "@/components/ui";
import { responseLabel } from "@/domain/scale";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  try {
    return await getBriefing(slug, await getActor());
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await load((await params).slug);
  return { title: b.headline };
}

export default async function StoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ update?: string }> }) {
  const { slug } = await params;
  const { update } = await searchParams;
  const actor = await getActor();
  const b = await load(slug);
  await track("story_viewed", { subjectId: actor?.id, storyId: b.id });
  const editing = update === "1" && !!b.myRating;

  return (
    <article className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
      <div className="mx-auto w-full max-w-3xl lg:mx-0">
        <BackLink href="/">Discover</BackLink>
        <BriefingBody b={b} />

        <div className="mt-4 flex flex-wrap gap-1 border-y border-line py-1">
          <BookmarkButton storyId={b.id} initial={b.bookmarked} signedIn={!!actor} />
          <ShareButton storyId={b.id} headline={b.headline} />
          <ReportButton targetType="story" targetId={b.id} signedIn={!!actor} />
        </div>
      </div>

      {/* On large screens the rating form sits beside the briefing and stays in view while reading. */}
      <section aria-labelledby="your-view" className="mt-8 lg:sticky lg:top-20 lg:mt-14 lg:-mx-2 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:p-2">
        <h2 id="your-view" className="sr-only">Your view</h2>
        {!b.question ? (
          <Notice>This briefing doesn't have a question yet.</Notice>
        ) : b.myRating && !editing ? (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-ink-2">You answered</p>
            <p className="mt-1 font-serif text-xl font-semibold">{responseLabel(b.question.scale, b.myRating.type, b.myRating.value)}</p>
            <p className="mt-1 text-sm text-ink-2">{b.question.text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/stories/${b.slug}/results`} className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-accent-ink">See results</Link>
              <Link href={`/stories/${b.slug}?update=1`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold">Update my view</Link>
            </div>
          </div>
        ) : (
          <>
            {b.answeredEarlierVersion && (
              <Notice className="mb-3">Editors revised this question after you answered. Your earlier answer is kept with the earlier version; please answer the current wording.</Notice>
            )}
            <RatingForm questionId={b.question.id} questionVersion={b.question.version} questionText={b.question.text} scale={b.question.scale} slug={b.slug} signedIn={!!actor} existing={editing ? (b.myRating as never) : null} />
          </>
        )}
        {b.hasRatedStory && !b.myRating && (
          <p className="mt-3 text-center text-sm"><Link className="underline" href={`/stories/${b.slug}/results`}>See results for the earlier version</Link></p>
        )}
      </section>
    </article>
  );
}

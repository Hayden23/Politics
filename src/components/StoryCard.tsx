import Link from "next/link";
import type { StoryCard as Card } from "@/server/services/reader";
import { formatDate } from "@/lib/format";
import { Badge } from "./ui";

export function StoryCard({ story, featured }: { story: Card; featured?: boolean }) {
  return (
    <article className={`group relative rounded-2xl border border-line bg-surface transition hover:border-ink-3 ${featured ? "p-6" : "p-5"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-3">
        {story.topicName && <span className="uppercase tracking-wider">{story.topicName}</span>}
        <span>{formatDate(story.date)}</span>
        <span>{story.readingMinutes} min read</span>
        {story.rated && <Badge tone="accent">You answered</Badge>}
      </div>
      <h2 className={`mt-2 font-serif font-semibold leading-snug ${featured ? "text-2xl" : "text-lg"}`}>
        <Link href={`/stories/${story.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
          {story.headline}
        </Link>
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{story.summary}</p>
      <p className="mt-3 text-sm font-semibold text-accent">{story.rated ? "See results →" : "Read and respond →"}</p>
    </article>
  );
}

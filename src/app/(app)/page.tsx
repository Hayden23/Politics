import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { listFeed, listTopics } from "@/server/services/reader";
import { StoryCard } from "@/components/StoryCard";
import { Chip, Empty } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Discover({ searchParams }: { searchParams: Promise<{ topic?: string; page?: string }> }) {
  const sp = await searchParams;
  const actor = await getActor();
  if (!actor && !(await cookies()).get("cl_welcomed")) redirect("/welcome");
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const limit = 10;
  const [topics, feed, answered] = await Promise.all([
    listTopics(),
    listFeed(actor, { topic: sp.topic, offset: page * limit, limit, answered: actor ? false : undefined }),
    actor && page === 0 ? listFeed(actor, { topic: sp.topic, limit: 6, answered: true }) : Promise.resolve(null),
  ]);
  const [featured, ...rest] = feed.items;
  const q = (p: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams(Object.entries({ topic: sp.topic, ...p }).filter(([, v]) => v !== undefined && String(v) !== "0").map(([k, v]) => [k, String(v)]));
    return s.toString() ? `/?${s}` : "/";
  };

  return (
    <div>
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Daily briefing · {formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">Discover</h1>
        <p className="mt-1 text-ink-2">Read the issue first. Sources and results appear after you answer.</p>
      </header>

      <nav aria-label="Filter by topic" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip href="/" active={!sp.topic}>All</Chip>
        {topics.map((t) => (
          <Chip key={t.slug} href={`/?topic=${t.slug}`} active={sp.topic === t.slug}>{t.name}</Chip>
        ))}
      </nav>

      {!featured ? (
        <Empty title={actor && page === 0 ? "You're all caught up" : "No briefings here yet"}>
          {sp.topic ? <Link href="/" className="underline">See all topics</Link> : "New briefings are published after editorial review. Check back soon."}
        </Empty>
      ) : (
        <div className="space-y-4">
          {page === 0 ? <StoryCard story={featured} featured /> : <StoryCard story={featured} />}
          {rest.map((s) => <StoryCard key={s.id} story={s} />)}
        </div>
      )}

      {(page > 0 || feed.nextOffset !== null) && (
        <nav aria-label="Pagination" className="mt-6 flex justify-between">
          {page > 0 ? <Link className="rounded-lg px-3 py-2 font-semibold" href={q({ page: page - 1 })}>← Newer</Link> : <span />}
          {feed.nextOffset !== null && <Link className="rounded-lg px-3 py-2 font-semibold" href={q({ page: page + 1 })}>Older →</Link>}
        </nav>
      )}

      {answered && answered.items.length > 0 && (
        <section className="mt-10" aria-labelledby="answered">
          <h2 id="answered" className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">Previously answered</h2>
          <div className="space-y-3">{answered.items.map((s) => <StoryCard key={s.id} story={s} />)}</div>
        </section>
      )}
    </div>
  );
}

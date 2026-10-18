import Link from "next/link";
import { requirePageActor } from "@/server/auth/session";
import { myRatings } from "@/server/services/ratings";
import { listBookmarks } from "@/server/services/bookmarks";
import { listTopics } from "@/server/services/reader";
import { responseLabel } from "@/domain/scale";
import { Card, Empty, PageHeader } from "@/components/ui";
import { formatDate, plural } from "@/lib/format";
import { RemoveBookmark } from "./RemoveBookmark";

export const dynamic = "force-dynamic";
export const metadata = { title: "My views" };

const TABS = [
  { k: "recent", label: "Recent" },
  { k: "changed", label: "Changed" },
  { k: "saved", label: "Saved" },
  { k: "timeline", label: "Timeline" },
] as const;
type Tab = (typeof TABS)[number]["k"];

export default async function MyViews({ searchParams }: { searchParams: Promise<{ tab?: string; topic?: string }> }) {
  const sp = await searchParams;
  const actor = await requirePageActor("/me");
  const tab: Tab = TABS.some((t) => t.k === sp.tab) ? (sp.tab as Tab) : "recent";
  const [all, topics, saved] = await Promise.all([myRatings(actor), listTopics(), tab === "saved" ? listBookmarks(actor) : Promise.resolve([])]);

  const counts = new Map<string, number>();
  for (const r of all) if (r.topicSlug) counts.set(r.topicSlug, (counts.get(r.topicSlug) ?? 0) + 1);
  const topicName = topics.find((t) => t.slug === sp.topic)?.name;
  const ratings = sp.topic ? all.filter((r) => r.topicSlug === sp.topic) : all;

  const href = (p: { tab?: string; topic?: string | null }) => {
    const q = new URLSearchParams();
    const t = p.tab ?? tab;
    const topic = p.topic === undefined ? sp.topic : p.topic;
    if (t !== "recent") q.set("tab", t);
    if (topic) q.set("topic", topic);
    return q.toString() ? `/me?${q}` : "/me";
  };

  const timeline = ratings
    .flatMap((r) =>
      (r.history.length ? r.history : [{ type: r.current.type, value: r.current.value, at: r.firstAnsweredAt }]).map((h, i) => ({
        key: `${r.ratingId}-${i}`,
        at: h.at,
        first: i === 0,
        label: h.type ? responseLabel(r.scale, h.type, h.value) : "—",
        r,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div>
      <PageHeader title="My views" kicker="Private to you">
        <p>Only you can see this. We never assign you a political label.</p>
      </PageHeader>

      <Card className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-2">Questions answered</p>
          <p className="font-serif text-4xl font-semibold tabular-nums">{all.length.toLocaleString("en-US")}</p>
        </div>
        <div className="text-right text-sm">
          <a href="/api/me/export" download className="inline-flex min-h-11 items-center font-semibold underline">Download my data</a>
          <br />
          <Link href="/profile#privacy" className="inline-flex min-h-11 items-center text-ink-2 underline">Privacy settings</Link>
        </div>
      </Card>

      <Link href="/me/summary" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:border-ink-3 hover:bg-surface-2/50">
        <span>
          <span className="block font-semibold">Your week in review →</span>
          <span className="mt-0.5 block text-sm text-ink-2">What you answered and changed in the last 7 days. Private to you.</span>
        </span>
      </Link>

      <section aria-labelledby="by-topic" className="mb-8">
        <div className="flex items-baseline justify-between">
          <h2 id="by-topic" className="text-sm font-semibold uppercase tracking-wider text-ink-3">By topic</h2>
          {sp.topic && <Link href={href({ topic: null })} className="text-sm font-medium underline">Show all topics</Link>}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {topics.map((t) => {
            const on = sp.topic === t.slug;
            return (
              <li key={t.slug}>
                <Link
                  href={href({ topic: on ? null : t.slug })}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-16 flex-col justify-center rounded-xl border px-3 py-2 ${on ? "border-ink bg-surface-2 ring-1 ring-ink" : "border-line bg-surface hover:bg-surface-2"}`}
                >
                  <span className="text-sm font-medium leading-snug">{t.name}</span>
                  <span className="text-xs tabular-nums text-ink-3">{plural(counts.get(t.slug) ?? 0, "answer")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <nav aria-label="My views sections" className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={href({ tab: t.k })}
            aria-current={tab === t.k ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold ${tab === t.k ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {topicName && tab !== "saved" && <p className="mb-3 text-sm text-ink-2">Showing {topicName} only.</p>}

      {tab === "recent" &&
        (ratings.length === 0 ? (
          <Empty title={sp.topic ? `No answers in ${topicName ?? "this topic"} yet` : "You haven't answered any questions yet"}>
            <Link href={sp.topic ? `/?topic=${sp.topic}` : "/"} className="underline">Read a briefing</Link> and share your view.
          </Empty>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.ratingId}>
                <Card>
                  <p className="text-xs text-ink-3">{[r.topicName, formatDate(r.updatedAt)].filter(Boolean).join(" · ")}</p>
                  {r.storyAvailable ? (
                    <Link href={`/stories/${r.slug}`} className="mt-1 block font-serif text-lg font-semibold leading-snug hover:underline">{r.headline}</Link>
                  ) : (
                    <p className="mt-1 font-serif text-lg font-semibold leading-snug">{r.headline} <span className="text-sm font-normal text-ink-3">(no longer available)</span></p>
                  )}
                  <p className="mt-1 text-sm text-ink-2">{r.questionText}</p>
                  <p className="mt-2 text-sm">
                    Your answer: <span className="font-semibold">{responseLabel(r.scale, r.current.type, r.current.value)}</span>
                    {r.questionRetired && <span className="text-ink-3"> · earlier question version</span>}
                  </p>
                  {r.storyAvailable && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!r.questionRetired && (
                        <Link href={`/stories/${r.slug}?update=1`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-surface-2">Update</Link>
                      )}
                      <Link href={`/stories/${r.slug}/results`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-surface-2">Results</Link>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ))}

      {tab === "changed" &&
        (() => {
          const changed = ratings.filter((r) => r.changed);
          return changed.length === 0 ? (
            <Empty title="No changed positions">When you update an answer, the original and your current view appear here side by side.</Empty>
          ) : (
            <ul className="space-y-3">
              {changed.map((r) => (
                <li key={r.ratingId}>
                  <Card>
                    {r.storyAvailable ? (
                      <Link href={`/stories/${r.slug}/results`} className="font-serif text-lg font-semibold leading-snug hover:underline">{r.headline}</Link>
                    ) : (
                      <p className="font-serif text-lg font-semibold leading-snug">{r.headline}</p>
                    )}
                    <p className="mt-1 text-sm text-ink-2">{r.questionText}</p>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-lg bg-surface-2 px-2.5 py-1">
                        <span className="sr-only">Originally: </span>{responseLabel(r.scale, r.original.type, r.original.value)}
                      </span>
                      <span aria-hidden>→</span>
                      <span className="rounded-lg border border-ink px-2.5 py-1 font-semibold">
                        <span className="sr-only">Now: </span>{responseLabel(r.scale, r.current.type, r.current.value)}
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-ink-3">First answered {formatDate(r.firstAnsweredAt)} · changed {plural(Math.max(1, r.history.length - 1), "time")} · last on {formatDate(r.updatedAt)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          );
        })()}

      {tab === "saved" &&
        (saved.length === 0 ? (
          <Empty title="Nothing saved yet">Tap “Save” on any briefing to keep it here for later.</Empty>
        ) : (
          <ul className="space-y-3">
            {saved.map((b) => (
              <li key={b.id}>
                <Card>
                  <p className="text-xs text-ink-3">{[b.topicName, `Saved ${formatDate(b.savedAt)}`].filter(Boolean).join(" · ")}</p>
                  <Link href={`/stories/${b.slug}`} className="mt-1 block font-serif text-lg font-semibold leading-snug hover:underline">{b.headline}</Link>
                  <p className="mt-1 text-sm text-ink-2">{b.summary}</p>
                  <div className="mt-2"><RemoveBookmark storyId={b.id} headline={b.headline} /></div>
                </Card>
              </li>
            ))}
          </ul>
        ))}

      {tab === "timeline" &&
        (timeline.length === 0 ? (
          <Empty title="Your timeline is empty">Every answer and change you make will be listed here, most recent first.</Empty>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-2">Every answer and change, most recent first.</p>
            <ol className="space-y-0 border-l-2 border-line pl-5">
              {timeline.map((e) => (
                <li key={e.key} className="relative pb-5">
                  <span aria-hidden className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-bg bg-bar-strong" />
                  <p className="text-xs text-ink-3"><time dateTime={e.at}>{formatDate(e.at)}</time> · {e.first ? "Answered" : "Changed answer"}</p>
                  <p className="mt-0.5 font-semibold">{e.label}</p>
                  <p className="text-sm text-ink-2">
                    {e.r.storyAvailable ? <Link href={`/stories/${e.r.slug}`} className="underline">{e.r.headline}</Link> : e.r.headline}
                  </p>
                </li>
              ))}
            </ol>
          </>
        ))}
    </div>
  );
}

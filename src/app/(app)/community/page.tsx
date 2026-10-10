import Link from "next/link";
import { getActor } from "@/server/auth/session";
import { activeDiscussions } from "@/server/services/community";
import { Card, Empty, PageHeader } from "@/components/ui";
import { formatDate, plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community" };

function ago(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 3600_000;
  if (h < 1) return "less than an hour ago";
  if (h < 24) return `${Math.floor(h)} h ago`;
  if (h < 24 * 7) return `${Math.floor(h / 24)} d ago`;
  return formatDate(iso);
}

export default async function Community() {
  const actor = await getActor();
  const items = await activeDiscussions(actor, 30);

  return (
    <div>
      <PageHeader title="Community" kicker="Discussions">
        <p>Recently active conversations. Each discussion opens after you've answered that story's question, so everyone in it has thought it through first.</p>
      </PageHeader>

      {!actor && (
        <p className="mb-5 text-sm text-ink-2">
          <Link href="/login?next=/community" className="font-semibold underline">Sign in</Link> to answer questions and join discussions.
        </p>
      )}

      {items.length === 0 ? (
        <Empty title="No active discussions yet">
          Answer a question on <Link href="/" className="underline">Discover</Link> and be the first to explain your view.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.questionId}>
              <Card>
                <p className="text-xs text-ink-3">{[d.topicName, `Active ${ago(d.lastActivity)}`].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 font-serif text-lg font-semibold leading-snug">{d.headline}</p>
                <p className="mt-1 text-sm text-ink-2">{plural(d.comments, "explanation")}</p>
                {d.unlocked ? (
                  <Link href={`/stories/${d.slug}/discussion`} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-surface-2">
                    Join the discussion →
                  </Link>
                ) : (
                  <Link href={`/stories/${d.slug}`} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">
                    Answer to join
                  </Link>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-ink-2">
        Disagreement is welcome; personal attacks aren't. Read the <Link href="/guidelines" className="underline">community guidelines</Link>.
      </p>
    </div>
  );
}

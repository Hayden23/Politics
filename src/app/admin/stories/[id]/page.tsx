import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { requireEditor } from "../../_lib/guard";
import { getForEditor } from "@/server/services/editorial";
import { auditLog } from "@/server/services/admin";
import { listTopics } from "@/server/services/reader";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { HttpError } from "@/lib/errors";
import { Badge, Card, LinkButton } from "@/components/ui";
import { JsonDetails, StatusBadge, Time } from "@/components/admin/bits";
import { StoryEditor, type EditorData } from "@/components/admin/StoryEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit story" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export default async function StoryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireEditor(`/admin/stories/${id}`);
  if (!UUID.test(id)) notFound();

  let data: Awaited<ReturnType<typeof getForEditor>>;
  try {
    data = await getForEditor(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { story } = data;
  const current = data.versions.find((v) => v.versionNumber === story.currentVersion) ?? data.versions[data.versions.length - 1];

  const [topics, audits] = await Promise.all([
    listTopics(),
    // Question changes are logged against the question id, so include those too.
    Promise.all([id, ...data.questions.map((q) => q.id)].map((entityId) => auditLog(actor, { entityId, limit: 100 }))).then((r) =>
      r.flat().sort((a, b) => +b.log.createdAt - +a.log.createdAt),
    ),
  ]);

  // Minimal read-only lookup so the version history can show editor names instead of ids.
  const personIds = [...new Set(data.versions.flatMap((v) => [v.createdBy, v.approvedBy]).filter((x): x is string => !!x))];
  const people = personIds.length ? await db.select({ id: users.id, name: users.displayName, email: users.email }).from(users).where(inArray(users.id, personIds)) : [];
  const who = (uid: string | null) => {
    if (!uid) return null;
    const p = people.find((x) => x.id === uid);
    return p?.name ?? p?.email ?? "Unknown editor";
  };

  const editorData: EditorData = {
    story: {
      id: story.id,
      slug: story.slug,
      status: story.status,
      headline: story.headline,
      briefing: story.briefing,
      keyFacts: story.keyFacts,
      disputedClaims: story.disputedClaims,
      uncertainties: story.uncertainties,
      topicId: story.topicId,
      eventAt: iso(story.eventAt),
      editorialPriority: story.editorialPriority,
      currentVersion: story.currentVersion,
    },
    editorialNotes: current?.editorialNotes ?? null,
    aiDraft: current?.aiDraft ?? null,
    currentVersionPublished: !!current?.publishedAt,
    questions: data.questions.map((q) => ({
      id: q.id,
      version: q.version,
      status: q.status,
      questionText: q.questionText,
      allowUncertain: q.scaleConfig.allowUncertain,
      supportGrouping: q.scaleConfig.supportGrouping,
      createdAt: q.createdAt.toISOString(),
      publishedAt: iso(q.publishedAt),
      retiredAt: iso(q.retiredAt),
    })),
    sources: data.sources.map(({ source: s, link }) => ({
      id: s.id,
      publisherName: s.publisherName,
      originalHeadline: s.originalHeadline,
      author: s.author,
      sourceUrl: s.sourceUrl,
      sourceType: s.sourceType,
      publishedAt: iso(s.publishedAt),
      rightsStatus: s.rightsStatus,
      relationshipType: link.relationshipType,
      claimsSupported: link.claimsSupported ?? [],
      linkStatus: s.linkStatus,
    })),
    problems: data.problems,
    topics: topics.map((t) => ({ id: t.id, name: t.name })),
  };

  const aiUnapproved = !!current?.aiDraft && story.status !== "approved" && story.status !== "published";

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-2">
        <Link href={`/admin/stories?status=${story.status}`} className="hover:underline">← Back to list</Link>
      </nav>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={story.status} />
          <Badge>v{story.currentVersion}</Badge>
          {data.topic && <Badge>{data.topic.name}</Badge>}
          {aiUnapproved && <Badge tone="warn">AI draft present · unapproved</Badge>}
        </div>
        <h1 className="mt-2 font-serif text-2xl font-semibold leading-tight sm:text-3xl">{story.headline}</h1>
        <p className="mt-1 text-sm text-ink-3">
          Updated <Time value={story.updatedAt} />
          {story.publishedAt && <> · First published <Time value={story.publishedAt} /></>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton variant="secondary" href={`/admin/stories/${story.id}/preview?mode=pre`}>Preview as reader</LinkButton>
          {story.status === "published" && (
            <LinkButton variant="ghost" href={`/stories/${story.slug}`}>Open live page</LinkButton>
          )}
        </div>
      </header>

      <StoryEditor data={editorData} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Version history</h2>
          <ol className="mt-3 space-y-3">
            {[...data.versions].reverse().map((v) => (
              <li key={v.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Version {v.versionNumber}</span>
                  {v.versionNumber === story.currentVersion && <Badge tone="accent">current</Badge>}
                  {v.aiDraft && <Badge tone="warn">AI draft attached</Badge>}
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-ink-3">Created</dt>
                  <dd><Time value={v.createdAt} />{who(v.createdBy) && <> by {who(v.createdBy)}</>}</dd>
                  <dt className="text-ink-3">Approved</dt>
                  <dd>{v.approvedAt ? <><Time value={v.approvedAt} /> by {who(v.approvedBy)}</> : "Not approved"}</dd>
                  <dt className="text-ink-3">Published</dt>
                  <dd>{v.publishedAt ? <Time value={v.publishedAt} /> : "Not published"}</dd>
                  {v.correctionNote && (
                    <>
                      <dt className="text-ink-3">Correction</dt>
                      <dd>{v.correctionNote}</dd>
                    </>
                  )}
                </dl>
                <p className="mt-2 text-ink-2">“{v.headline}”</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Audit trail</h2>
          {!audits.length ? (
            <p className="mt-3 text-sm text-ink-3">No recorded actions.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {audits.map(({ log, actorName }) => (
                <li key={log.id} className="rounded-xl border border-line p-3 text-sm">
                  <p>
                    <span className="font-semibold">{log.action}</span> · {actorName ?? (log.actorId ? "Unknown" : "System")}
                  </p>
                  <p className="text-xs text-ink-3"><Time value={log.createdAt} /></p>
                  <div className="mt-1 flex flex-wrap gap-4">
                    <JsonDetails label="Before" value={log.beforeState} />
                    <JsonDetails label="After" value={log.afterState} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireEditor } from "../_lib/guard";
import { db } from "@/server/db";
import { sources, stories, storySources } from "@/server/db/schema";
import { Empty, PageHeader } from "@/components/ui";
import { StatusBadge, TableWrap, Time, tdClass, thClass } from "@/components/admin/bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Broken source links" };

export default async function SourcesPage() {
  await requireEditor("/admin/sources");
  // Read-only query local to this page: broken links on each story's current version.
  const rows = await db
    .selectDistinct({
      sourceId: sources.id,
      publisher: sources.publisherName,
      url: sources.sourceUrl,
      checkedAt: sources.linkCheckedAt,
      storyId: stories.id,
      headline: stories.headline,
      status: stories.status,
    })
    .from(sources)
    .innerJoin(storySources, eq(storySources.sourceId, sources.id))
    .innerJoin(stories, and(eq(stories.id, storySources.storyId), eq(stories.currentVersion, storySources.storyVersion)))
    .where(eq(sources.linkStatus, "broken"))
    .orderBy(desc(sources.linkCheckedAt))
    .limit(300);

  return (
    <div>
      <PageHeader kicker="Editorial" title="Broken source links">
        Links the daily checker couldn't reach. On unpublished stories, replace the source in the editor. On published stories, attach a working replacement and publish a correction explaining the change.
      </PageHeader>
      {!rows.length ? (
        <Empty title="No broken links">Every checked source link responded.</Empty>
      ) : (
        <TableWrap label="Broken source links">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">Sources whose most recent link check failed</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Source</th>
                <th scope="col" className={thClass}>Story</th>
                <th scope="col" className={thClass}>Last checked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.sourceId}-${r.storyId}`}>
                  <td className={tdClass}>
                    <p className="font-semibold">{r.publisher}</p>
                    <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent underline">
                      {r.url}<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </td>
                  <td className={tdClass}>
                    <Link href={`/admin/stories/${r.storyId}`} className="font-medium hover:underline">{r.headline}</Link>
                    <div className="mt-1"><StatusBadge status={r.status} /></div>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}><Time value={r.checkedAt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}

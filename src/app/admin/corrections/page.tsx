import Link from "next/link";
import { requireEditor } from "../_lib/guard";
import { listForEditors } from "@/server/services/editorial";
import { Empty, LinkButton, PageHeader } from "@/components/ui";
import { TableWrap, Time, tdClass, thClass } from "@/components/admin/bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Corrections" };

export default async function CorrectionsPage() {
  await requireEditor("/admin/corrections");
  const rows = await listForEditors("published");

  return (
    <div>
      <PageHeader kicker="Editorial" title="Corrections">
        Live stories change only through a correction: a new, approved version with a public correction note readers can see.
      </PageHeader>
      {!rows.length ? (
        <Empty title="No published stories" />
      ) : (
        <TableWrap label="Published stories">
          <table className="w-full min-w-[600px] border-collapse">
            <caption className="sr-only">Published stories that can be corrected</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Headline</th>
                <th scope="col" className={thClass}>Topic</th>
                <th scope="col" className={thClass}>Version</th>
                <th scope="col" className={thClass}>Published</th>
                <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ story: s, topic }) => (
                <tr key={s.id}>
                  <td className={tdClass}><Link href={`/admin/stories/${s.id}`} className="font-semibold hover:underline">{s.headline}</Link></td>
                  <td className={`${tdClass} text-ink-2`}>{topic ?? "—"}</td>
                  <td className={`${tdClass} tabular-nums text-ink-2`}>v{s.currentVersion}{s.currentVersion > 1 ? " (corrected/revised)" : ""}</td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}><Time value={s.publishedAt} /></td>
                  <td className={tdClass}>
                    <LinkButton variant="secondary" href={`/admin/stories/${s.id}#correction`} aria-label={`Correct: ${s.headline}`}>Correct</LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}

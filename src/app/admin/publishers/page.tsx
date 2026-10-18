import { requireEditor } from "../_lib/guard";
import { listPublishers } from "@/server/services/publishers";
import type { Lean } from "@/domain/lean";
import { Card, Empty, PageHeader } from "@/components/ui";
import { TableWrap, tdClass, thClass } from "@/components/admin/bits";
import { AddPublisher, PublisherTableRow } from "@/components/admin/PublisherForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publishers" };

export default async function PublishersPage() {
  const actor = await requireEditor("/admin/publishers");
  const rows = await listPublishers(actor);
  const rated = rows.filter((r) => r.p.lean !== "unrated").length;

  return (
    <div>
      <PageHeader kicker="Editorial" title="Publishers & lean ratings">
        <p>
          Outlets behind attached sources and candidate leads. Every lean rating must cite a basis — for example a named media-bias rating service or a documented editorial assessment — so it can be explained and checked. Leave an outlet “Not rated” rather than guessing.
        </p>
        <p className="mt-2">
          Readers see an outlet’s lean only after they rate a story, alongside its sources; it never appears in the briefing. Ratings also drive the coverage-mix advisories in the editor and the candidate clusters.
        </p>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="pub-list" className="min-w-0">
          <h2 id="pub-list" className="mb-3 text-lg font-semibold">
            Outlets <span className="text-sm font-normal text-ink-3">({rows.length}, {rated} rated)</span>
          </h2>
          {!rows.length ? (
            <Empty title="No outlets yet">Outlets are added automatically when sources are attached, or you can add one here.</Empty>
          ) : (
            <TableWrap label="Publishers">
              <table className="w-full min-w-[720px] border-collapse">
                <caption className="sr-only">Publishers with lean rating, basis and number of sources</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Name</th>
                    <th scope="col" className={thClass}>Domain</th>
                    <th scope="col" className={thClass}>Lean</th>
                    <th scope="col" className={thClass}>Basis</th>
                    <th scope="col" className={thClass}>Sources</th>
                    <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, sourceCount }) => (
                    <PublisherTableRow
                      key={p.id}
                      tdClass={tdClass}
                      sourceCount={sourceCount}
                      publisher={{ id: p.id, name: p.name, domain: p.domain, lean: p.lean as Lean, leanBasis: p.leanBasis, notes: p.notes }}
                    />
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </section>
        <aside>
          <Card>
            <h2 className="text-lg font-semibold">Add an outlet</h2>
            <p className="mt-1 text-sm text-ink-2">Sources already attached from the same domain are linked to it automatically.</p>
            <div className="mt-3"><AddPublisher /></div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

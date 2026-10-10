import { requireStaff } from "../_lib/guard";
import { launchMetrics, recentErrors } from "@/server/services/admin";
import { isAdmin } from "@/server/auth/roles";
import { Card, Empty, PageHeader } from "@/components/ui";
import { TableWrap, Time, tdClass, thClass } from "@/components/admin/bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Metrics" };

const rate = (v: number | null | undefined) => (v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`);
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export default async function MetricsPage() {
  const actor = await requireStaff("/admin/metrics");
  const [m, errors] = await Promise.all([launchMetrics(actor, 30), isAdmin(actor) ? recentErrors(actor) : Promise.resolve(null)]);
  const ret = m.retention;
  const cohort = num(ret?.cohort);
  const retRate = (n: unknown) => (cohort ? rate(num(n) / cohort) : "—");

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: "First-rating conversion", value: rate(m.firstRatingConversion), hint: "Raters ÷ story viewers" },
    { label: "Ratings per active rater", value: m.ratingsPerActiveRater === null ? "—" : m.ratingsPerActiveRater.toFixed(2) },
    { label: "Rated a second story", value: rate(m.secondStoryRate), hint: "Share of raters" },
    { label: "Viewed results", value: rate(m.resultsViewRate), hint: "Share of raters" },
    { label: "Explored perspectives", value: rate(m.perspectiveRate), hint: "Share of raters" },
    { label: "Revealed sources", value: rate(m.sourceRevealRate), hint: "Share of raters" },
    { label: "Correction rate", value: rate(m.correctionRate), hint: "Published stories with a correction" },
    { label: "Broken source links", value: m.brokenSourceLinks.toLocaleString("en-US") },
    { label: "Server errors", value: m.serverErrors.toLocaleString("en-US"), hint: `Last ${m.days} days` },
  ];

  return (
    <div>
      <PageHeader kicker="Oversight" title="Launch metrics">
        Last {m.days} days, from privacy-minimized events (no response values, no free text). Rates are of distinct pseudonymous subjects.
      </PageHeader>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-ink-2">{t.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</dd>
            {t.hint && <dd className="mt-0.5 text-xs text-ink-3">{t.hint}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Retention</h2>
          <p className="mt-1 text-sm text-ink-2">Subjects first seen in the window ({cohort.toLocaleString("en-US")}) who returned on day 1, 7 and 30.</p>
          <TableWrap label="Retention">
            <table className="w-full border-collapse">
              <caption className="sr-only">Retention by day</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Day</th>
                  <th scope="col" className={`${thClass} text-right`}>Returned</th>
                  <th scope="col" className={`${thClass} text-right`}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {(["d1", "d7", "d30"] as const).map((k) => (
                  <tr key={k}>
                    <th scope="row" className={`${tdClass} text-left font-medium`}>Day {k.slice(1)}</th>
                    <td className={`${tdClass} text-right tabular-nums`}>{num(ret?.[k]).toLocaleString("en-US")}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{retRate(ret?.[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Event counts</h2>
          {!m.events.length ? (
            <p className="mt-2 text-sm text-ink-3">No events recorded in this window.</p>
          ) : (
            <div className="mt-3">
              <TableWrap label="Event counts">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Analytics events in the last {m.days} days</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Event</th>
                      <th scope="col" className={`${thClass} text-right`}>Count</th>
                      <th scope="col" className={`${thClass} text-right`}>Distinct subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...m.events].sort((a, b) => b.n - a.n).map((e) => (
                      <tr key={e.name}>
                        <th scope="row" className={`${tdClass} text-left font-mono text-xs font-medium`}>{e.name}</th>
                        <td className={`${tdClass} text-right tabular-nums`}>{num(e.n).toLocaleString("en-US")}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{num(e.subjects).toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          )}
        </Card>
      </div>

      {errors && (
        <section className="mt-8" aria-labelledby="errs">
          <h2 id="errs" className="mb-3 text-lg font-semibold">Recent server errors</h2>
          {!errors.length ? (
            <Empty title="No recorded errors" />
          ) : (
            <TableWrap label="Recent server errors">
              <table className="w-full min-w-[640px] border-collapse">
                <caption className="sr-only">The 100 most recent server errors</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Time</th>
                    <th scope="col" className={thClass}>Path</th>
                    <th scope="col" className={thClass}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e) => (
                    <tr key={e.id}>
                      <td className={`${tdClass} whitespace-nowrap text-ink-2`}><Time value={e.createdAt} /></td>
                      <td className={`${tdClass} font-mono text-xs`}>{e.path ?? "—"}</td>
                      <td className={tdClass}>
                        <p>{e.message}</p>
                        {e.digest && <p className="text-xs text-ink-3">digest {e.digest}</p>}
                        {e.stack && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-medium text-ink-2">Stack trace</summary>
                            <pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 text-xs">{e.stack}</pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </section>
      )}
    </div>
  );
}

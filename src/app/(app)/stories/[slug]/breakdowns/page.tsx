import Link from "next/link";
import type { ReactNode } from "react";
import { getActor } from "@/server/auth/session";
import { storyBreakdowns, type GroupResult } from "@/server/services/breakdowns";
import { gated } from "@/lib/gate";
import { StoryHeader } from "@/components/StoryNav";
import { GroupedBar } from "@/components/GroupedBar";
import { StateTileMap, STATE_NAMES } from "@/components/StateTileMap";
import { Empty } from "@/components/ui";
import { pct, plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Breakdowns" };

type Scale = Parameters<typeof GroupedBar>[0]["scale"];

export default async function BreakdownsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getActor();
  const b = await gated(slug, () => storyBreakdowns(slug, actor));

  if (!b.question) {
    return (
      <div>
        <StoryHeader slug={slug} headline={b.headline} current="breakdowns" />
        <Empty title="No breakdowns yet">This briefing doesn't have a published question.</Empty>
      </div>
    );
  }

  const { question, ideology, states, age, area, change } = b;
  const scale = question.scale;
  const stateValues = states.groups.flatMap((g) => (g.available && g.distribution.grouping ? [{ code: g.key, support: g.distribution.grouping.support.percent, n: g.distribution.validCount }] : []));
  const gap = ideology.gap ? Math.round(ideology.gap.supportGap) : null;

  return (
    <div>
      <StoryHeader slug={slug} headline={b.headline} current="breakdowns" />

      <h2 className="font-serif text-2xl font-semibold">Breakdowns</h2>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        How answers to “{question.text}” differ across groups — counting only people who chose to share their details. These are participants in this app, not a representative sample.
      </p>

      <div className="mt-8 space-y-10">
        <Section id="ideology" title="By political self-identification">
          <GroupRows groups={ideology.groups} threshold={ideology.threshold} scale={scale} />
          {gap !== null && (
            <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm">
              {gap === 0
                ? "Support among self-identified liberals is about the same as among self-identified conservatives."
                : `Support among self-identified liberals is ${Math.abs(gap)} ${Math.abs(gap) === 1 ? "point" : "points"} ${gap > 0 ? "higher" : "lower"} than among self-identified conservatives.`}
            </p>
          )}
        </Section>

        <Section id="state" title="By state">
          <p className="mb-4 text-sm text-ink-2">Share who support, among people who shared their state. Hatched states have fewer than {states.threshold} such responses and are not shown.</p>
          <StateTileMap values={stateValues} threshold={states.threshold} />
          <details className="mt-4 rounded-xl border border-line bg-surface">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">Show as a table ({plural(stateValues.length, "state")} with enough responses)</summary>
            {states.groups.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-ink-2">No state has enough responses yet.</p>
            ) : (
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full text-sm tabular-nums">
                  <caption className="sr-only">Responses by state</caption>
                  <thead className="text-left text-ink-3">
                    <tr>
                      <th scope="col" className="py-1.5 font-medium">State</th>
                      <th scope="col" className="font-medium">Responses</th>
                      <th scope="col" className="font-medium">Oppose</th>
                      <th scope="col" className="font-medium">Neutral</th>
                      <th scope="col" className="font-medium">Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {states.groups.map((g) =>
                      g.available ? (
                        <tr key={g.key} className="border-t border-line">
                          <th scope="row" className="py-1.5 text-left font-medium">{STATE_NAMES[g.key] ?? g.key}</th>
                          <td>{g.distribution.validCount.toLocaleString("en-US")}</td>
                          <td>{g.distribution.grouping ? pct(g.distribution.grouping.oppose.percent) : "—"}</td>
                          <td>{g.distribution.grouping ? pct(g.distribution.grouping.neutral.percent) : "—"}</td>
                          <td>{g.distribution.grouping ? pct(g.distribution.grouping.support.percent) : "—"}</td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </Section>

        <Section id="age" title="By age range">
          <GroupRows groups={age.groups} threshold={age.threshold} scale={scale} />
        </Section>

        <Section id="area" title="By area type">
          <GroupRows groups={area.groups} threshold={area.threshold} scale={scale} />
        </Section>

        <Section id="change" title="Changed their minds">
          {change.respondents === 0 ? (
            <p className="text-sm text-ink-2">No answers to show yet.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Respondents" value={change.respondents.toLocaleString("en-US")} />
                <Stat label="Changed their answer" value={pct((change.changed / change.respondents) * 100)} sub={plural(change.changed, "person", "people")} />
                <Stat label="Moved toward support" value={change.towardSupport.toLocaleString("en-US")} />
                <Stat label="Moved toward oppose" value={change.towardOppose.toLocaleString("en-US")} />
                <Stat label="Resolved uncertainty" value={change.resolvedUncertain.toLocaleString("en-US")} sub={`Was “${scale.uncertainLabel}”`} />
                <Stat label="Became uncertain" value={change.becameUncertain.toLocaleString("en-US")} sub={`Now “${scale.uncertainLabel}”`} />
              </dl>
              <p className="mt-3 text-xs text-ink-3">Compares each person's first answer with their current one. Includes everyone who answered, not only those who shared demographics.</p>
            </>
          )}
        </Section>

        <aside aria-labelledby="method" className="rounded-2xl bg-surface-2 p-5 text-sm leading-relaxed text-ink-2">
          <h2 id="method" className="font-semibold text-ink">How these breakdowns work</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Only people who opted in to share demographic details are counted in group breakdowns.</li>
            <li>Figures are unweighted and not representative of any population.</li>
            <li>Groups with fewer than the minimum number of responses ({ideology.threshold} for political self-identification, {states.threshold} per state, {age.threshold} for age and area) are hidden entirely — not even their counts are shown.</li>
            <li>We never label any individual's politics.</li>
          </ul>
          <p className="mt-3"><Link href="/methodology#breakdowns" className="font-semibold underline">Read the full methodology</Link></p>
        </aside>

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Help make breakdowns possible</p>
            <p className="mt-1 text-sm text-ink-2">Sharing your details is optional, private and never shown on your profile.</p>
          </div>
          <Link href="/profile#demographics" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold transition hover:bg-surface-2">
            Add yours (optional) in Profile
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`bd-${id}`} className="scroll-mt-20">
      <h3 id={`bd-${id}`} className="mb-3 text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function GroupRows({ groups, threshold, scale }: { groups: GroupResult[]; threshold: number; scale: Scale }) {
  return (
    <ul className="space-y-3">
      {groups.map((g) => (
        <li key={g.key} className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm font-semibold">{g.label}</p>
          {g.available ? (
            <GroupedBar dist={g.distribution} scale={scale} />
          ) : (
            <p className="text-sm text-ink-3">Not enough responses yet (needs at least {threshold}).</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-ink-3">{sub}</dd>}
    </div>
  );
}

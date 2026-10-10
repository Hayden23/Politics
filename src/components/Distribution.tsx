import type { Distribution as D } from "@/domain/aggregation";
import type { ScaleConfig } from "@/server/db/schema";
import { pct, plural } from "@/lib/format";

/** Horizontal bars, one neutral color. The viewer's own answer is outlined, not recolored. */
export function Distribution({ dist, scale, mine }: { dist: D; scale: ScaleConfig; mine?: { type: string; value: number | null } | null }) {
  const max = Math.max(1, ...dist.buckets.map((b) => b.percent));
  return (
    <div>
      <ol className="space-y-2" aria-label="Distribution of responses">
        {dist.buckets.map((b) => {
          const isMine = mine?.type === "scale" && mine.value === b.value;
          const label = scale.labels[b.value - scale.min];
          return (
            <li key={b.value} className={`rounded-lg px-2 py-1.5 ${isMine ? "ring-2 ring-ink" : ""}`}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {label}
                  {isMine && <span className="ml-2 text-xs font-semibold text-ink-2">(you)</span>}
                </span>
                <span className="tabular-nums text-ink-2">
                  {pct(b.percent)} <span className="text-xs text-ink-3">({b.count.toLocaleString("en-US")})</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-bar" style={{ width: `${(b.percent / max) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Valid responses" value={dist.validCount.toLocaleString("en-US")} />
        <Stat label={`“${scale.uncertainLabel}”`} value={`${dist.uncertainCount.toLocaleString("en-US")}${mine?.type === "uncertain" ? " (incl. you)" : ""}`} />
        {dist.median !== null && <Stat label="Median response" value={scale.labels[dist.median - scale.min]} />}
      </dl>
      {dist.grouping && dist.validCount > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">Grouped</p>
          <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-bar-strong" style={{ width: `${dist.grouping.oppose.percent}%` }} />
            <div className="bg-surface-2" style={{ width: `${dist.grouping.neutral.percent}%` }} />
            <div className="bg-bar" style={{ width: `${dist.grouping.support.percent}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between text-sm tabular-nums text-ink-2">
            <span>Oppose {pct(dist.grouping.oppose.percent)}</span>
            <span>Neutral {pct(dist.grouping.neutral.percent)}</span>
            <span>Support {pct(dist.grouping.support.percent)}</span>
          </p>
        </div>
      )}
      {dist.smallSample && (
        <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          Small sample: only {plural(dist.validCount, "valid response")} so far. Treat these numbers with caution.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

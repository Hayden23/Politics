import type { Distribution as D } from "@/domain/aggregation";
import type { ScaleConfig } from "@/server/db/schema";
import { pct, plural } from "@/lib/format";

/**
 * Compact one-line summary of a distribution: oppose / neutral / support shares
 * in neutral greys. Used where the full Distribution would be too tall.
 */
export function GroupedBar({ dist, scale }: { dist: D; scale: ScaleConfig }) {
  const g = dist.grouping;
  const summary = g
    ? `Oppose ${pct(g.oppose.percent)}, neutral ${pct(g.neutral.percent)}, support ${pct(g.support.percent)}`
    : dist.median !== null
      ? `Median response: ${scale.labels[dist.median - scale.min]}`
      : "No valid responses yet";
  return (
    <div>
      {g && dist.validCount > 0 ? (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={summary}>
            <div className="bg-bar-strong" style={{ width: `${g.oppose.percent}%` }} />
            <div className="bg-surface-2" style={{ width: `${g.neutral.percent}%` }} />
            <div className="bg-bar" style={{ width: `${g.support.percent}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-xs tabular-nums text-ink-2">
            <span>Oppose {pct(g.oppose.percent)}</span>
            <span>Neutral {pct(g.neutral.percent)}</span>
            <span>Support {pct(g.support.percent)}</span>
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-2">{summary}</p>
      )}
      <p className="mt-1 text-xs text-ink-3">
        {plural(dist.validCount, "valid response")} · {dist.uncertainCount.toLocaleString("en-US")} “{scale.uncertainLabel}”
      </p>
      {dist.smallSample && <p className="mt-1.5 text-xs font-medium text-warn">Small sample — treat with caution.</p>}
    </div>
  );
}

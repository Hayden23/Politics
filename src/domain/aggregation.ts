/**
 * Poll aggregation. Integer counts are the source of truth; percentages are
 * derived here and rounded only for display. Uncertain responses are counted
 * separately and never folded into "Neutral" or into the valid-response base.
 */

export type CountRow = { responseType: "scale" | "uncertain"; responseValue: number | null; count: number };

export type Distribution = {
  /** Scale responses only. */
  validCount: number;
  uncertainCount: number;
  /** Valid + uncertain. */
  totalCount: number;
  buckets: { value: number; count: number; percent: number }[];
  grouping: { oppose: GroupShare; neutral: GroupShare; support: GroupShare } | null;
  median: number | null;
  smallSample: boolean;
  /** Percent of all responses (incl. uncertain) that were uncertain. */
  uncertainPercent: number;
};

type GroupShare = { count: number; percent: number };

export const SMALL_SAMPLE_THRESHOLD = Number(process.env.SMALL_SAMPLE_THRESHOLD ?? 30);

export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

/** Display rounding. Never used to adjust stored data or force totals to 100. */
export function displayPercent(p: number, digits = 0): string {
  return `${p.toFixed(digits)}%`;
}

export function aggregate(rows: CountRow[], opts: { min?: number; max?: number; supportGrouping?: boolean; smallSampleThreshold?: number } = {}): Distribution {
  const min = opts.min ?? 1;
  const max = opts.max ?? 7;
  const counts = new Map<number, number>();
  let uncertainCount = 0;
  for (const r of rows) {
    if (!Number.isInteger(r.count) || r.count < 0) throw new Error("Counts must be non-negative integers");
    if (r.responseType === "uncertain") uncertainCount += r.count;
    else if (r.responseValue != null && r.responseValue >= min && r.responseValue <= max) {
      counts.set(r.responseValue, (counts.get(r.responseValue) ?? 0) + r.count);
    }
  }
  const validCount = [...counts.values()].reduce((a, b) => a + b, 0);
  const buckets: Distribution["buckets"] = [];
  for (let v = min; v <= max; v++) {
    const c = counts.get(v) ?? 0;
    buckets.push({ value: v, count: c, percent: percent(c, validCount) });
  }
  const mid = (min + max) / 2;
  const sum = (pred: (v: number) => boolean) => buckets.filter((b) => pred(b.value)).reduce((a, b) => a + b.count, 0);
  const grouping =
    opts.supportGrouping === false
      ? null
      : {
          oppose: share(sum((v) => v < mid), validCount),
          neutral: share(sum((v) => v === mid), validCount),
          support: share(sum((v) => v > mid), validCount),
        };
  return {
    validCount,
    uncertainCount,
    totalCount: validCount + uncertainCount,
    buckets,
    grouping,
    median: ordinalMedian(buckets),
    smallSample: validCount < (opts.smallSampleThreshold ?? SMALL_SAMPLE_THRESHOLD),
    uncertainPercent: percent(uncertainCount, validCount + uncertainCount),
  };
}

function share(count: number, whole: number): GroupShare {
  return { count, percent: percent(count, whole) };
}

/** Lower median of an ordinal distribution (a category, never an interpolated value). */
export function ordinalMedian(buckets: { value: number; count: number }[]): number | null {
  const n = buckets.reduce((a, b) => a + b.count, 0);
  if (n === 0) return null;
  const target = Math.ceil(n / 2);
  let seen = 0;
  for (const b of buckets) {
    seen += b.count;
    if (seen >= target) return b.value;
  }
  return null;
}

/** Minimum-sample rule for publishing a breakdown (state, demographic, …). */
export function meetsThreshold(validCount: number, threshold: number): boolean {
  return Number.isFinite(threshold) && threshold > 0 && validCount >= threshold;
}

export const STATE_THRESHOLD = Number(process.env.STATE_RESULTS_THRESHOLD ?? 100);

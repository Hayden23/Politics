import Link from "next/link";
import { plural } from "@/lib/format";

type Counts = { left: number; center: number; right: number; unrated: number };

/*
 * Left and right deliberately share one neutral tone (no red/blue, no party
 * color): they are told apart by position and label, so neither side looks
 * favored. Center uses a lighter neutral, unrated a hatched fill.
 */
const SEGMENTS = [
  { k: "left", label: "Left", fill: "bg-bar-strong" },
  { k: "center", label: "Center", fill: "bg-bar" },
  { k: "right", label: "Right", fill: "bg-bar-strong" },
  { k: "unrated", label: "Not rated", fill: "hatch" },
] as const;

const hatch = { backgroundImage: "repeating-linear-gradient(45deg, var(--line) 0 3px, var(--surface-2) 3px 6px)" };

export function coverageSummary(c: { counts: Counts; total: number }) {
  return `Coverage used for this briefing: ${SEGMENTS.map((s) => `${s.label.toLowerCase()} ${c.counts[s.k]}`).join(", ")} of ${plural(c.total, "source")}.`;
}

/** Share of cited sources by outlet lean bucket, with a legend that carries the counts. */
export function CoverageBar({ coverage, headingLevel = 2, id = "coverage" }: { coverage: { counts: Counts; total: number }; headingLevel?: 2 | 3; id?: string }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const { counts, total } = coverage;
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-surface p-5">
      <H id={id} className="text-base font-semibold">Coverage balance</H>
      <p className="mt-1 text-sm text-ink-2">Outlets cited in this briefing, by their editor-assigned lean rating.</p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-ink-2">No sources are listed for this briefing yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-4 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={coverageSummary(coverage)}>
            {SEGMENTS.filter((s) => counts[s.k] > 0).map((s) => (
              <div
                key={s.k}
                title={`${s.label}: ${plural(counts[s.k], "source")}`}
                className={`h-full first:rounded-l-full last:rounded-r-full ${s.fill === "hatch" ? "" : s.fill}`}
                style={{ width: `${(counts[s.k] / total) * 100}%`, ...(s.fill === "hatch" ? hatch : {}) }}
              />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
            {SEGMENTS.map((s) => (
              <div key={s.k} className="flex items-center gap-2">
                <span aria-hidden className={`inline-block size-3 shrink-0 rounded-sm ${s.fill === "hatch" ? "border border-line" : s.fill}`} style={s.fill === "hatch" ? hatch : undefined} />
                <dt className="text-ink-2">{s.label}</dt>
                <dd className="ml-auto font-semibold tabular-nums sm:ml-0">{counts[s.k]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-3">
            {plural(total, "source")} in total. Lean ratings describe outlets, not individual articles, and are a rough guide — <Link href="/methodology#lean" className="underline">how ratings are assigned</Link>.
          </p>
        </>
      )}
    </section>
  );
}

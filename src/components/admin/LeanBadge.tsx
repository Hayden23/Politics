import Link from "next/link";
import { LEAN_LABELS, type Lean } from "@/domain/lean";

const isLean = (l: unknown): l is Lean => typeof l === "string" && l in LEAN_LABELS;

/** Outlet lean, deliberately in neutral tones (no red/blue). Optionally links to the publishers page. */
export function LeanBadge({ lean, publisherId, link = true }: { lean: string | null | undefined; publisherId?: string | null; link?: boolean }) {
  const l: Lean = isLean(lean) ? lean : "unrated";
  const text = `Outlet lean: ${LEAN_LABELS[l]}`;
  const cls = `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${l === "unrated" ? "border-dashed border-line text-ink-3" : "border-line bg-surface-2 text-ink-2"}`;
  if (!link) return <span className={cls}>{text}</span>;
  return (
    <Link href={publisherId ? `/admin/publishers#publisher-${publisherId}` : "/admin/publishers"} className={`${cls} underline-offset-2 hover:underline`}>
      {text}
      <span className="sr-only"> (manage outlet ratings)</span>
    </Link>
  );
}

export const MIX_ORDER = ["left", "center", "right", "unrated"] as const;
export type Mix = Record<(typeof MIX_ORDER)[number], number>;
const MIX_LABEL: Record<keyof Mix, string> = { left: "Left", center: "Center", right: "Right", unrated: "Not rated" };
const MIX_TONE: Record<keyof Mix, string> = {
  left: "bg-bar-strong",
  center: "bg-bar",
  right: "bg-ink-3",
  unrated: "bg-surface-2 bg-[repeating-linear-gradient(45deg,transparent_0_4px,var(--line)_4px_6px)]",
};

/** Left/center/right/unrated coverage mix as a neutral-toned bar with a text legend. */
export function MixBar({ mix }: { mix: Mix }) {
  const total = MIX_ORDER.reduce((n, k) => n + mix[k], 0);
  const summary = MIX_ORDER.map((k) => `${MIX_LABEL[k]} ${mix[k]}`).join(", ");
  return (
    <div>
      <div role="img" aria-label={`Outlet lean mix: ${summary}`} className="flex h-3 w-full overflow-hidden rounded-full border border-line bg-surface">
        {total > 0 &&
          MIX_ORDER.filter((k) => mix[k] > 0).map((k) => (
            <span key={k} className={`h-full ${MIX_TONE[k]} border-r border-surface last:border-r-0`} style={{ width: `${(mix[k] / total) * 100}%` }} />
          ))}
      </div>
      <ul aria-hidden className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
        {MIX_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={`inline-block size-2.5 rounded-sm border border-line ${MIX_TONE[k]}`} />
            {MIX_LABEL[k]} <span className="tabular-nums">{mix[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


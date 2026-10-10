import type { ReactNode } from "react";
import { Badge, Chip } from "@/components/ui";

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "in_review" ? "warn" : status === "approved" || status === "published" ? "accent" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status] ?? status.replace(/_/g, " ")}</Badge>;
}

/** Date + time in UTC so every editor sees the same timestamp. */
export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(+date)) return "—";
  return `${date.toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} UTC`;
}

export function Time({ value }: { value: string | Date | null | undefined }) {
  if (!value) return <span>—</span>;
  return <time dateTime={new Date(value).toISOString()}>{formatDateTime(value)}</time>;
}

export function Tabs({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-5 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {items.map((i) => (
          <li key={i.href}>
            <Chip href={i.href} active={i.active}>{i.label}</Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Horizontally scrollable wrapper so wide tables never push the page sideways on phones. */
export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-2xl border border-line bg-surface">
      {children}
    </div>
  );
}

export const thClass = "border-b border-line bg-surface-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-ink-2";
export const tdClass = "border-b border-line px-3 py-2.5 align-top text-sm";

export function JsonDetails({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return <span className="text-ink-3">—</span>;
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-ink-2">{label}</summary>
      <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export function SectionTitle({ id, children, hint }: { id?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-semibold">{children}</h2>
      {hint && <p className="mt-0.5 text-sm text-ink-2">{hint}</p>}
    </div>
  );
}

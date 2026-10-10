import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-surface text-danger border border-line hover:bg-surface-2",
};
const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed min-h-11";

export function Button({ variant = "primary", className = "", ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...p} className={`${base} ${variants[variant]} ${className}`} />;
}

export function LinkButton({ variant = "primary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...p} className={`${base} ${variants[variant]} ${className}`} />;
}

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div {...p} className={`rounded-2xl border border-line bg-surface p-5 ${className}`} />;
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {kicker && <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{kicker}</p>}
      <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{title}</h1>
      {children && <div className="mt-2 text-ink-2">{children}</div>}
    </header>
  );
}

export function Chip({ active, className = "", ...p }: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      {...p}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition ${active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"} ${className}`}
    />
  );
}

export function Notice({ tone = "info", children, className = "" }: { tone?: "info" | "warn"; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "warn" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${tone === "warn" ? "bg-warn-soft text-warn" : "bg-accent-soft text-ink"} ${className}`}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const t = tone === "accent" ? "bg-accent-soft text-accent" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-2";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export const inputClass = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-3 min-h-11";
export const labelClass = "mb-1.5 block text-sm font-semibold";

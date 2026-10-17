"use client";
import { useState } from "react";
import { Button, inputClass, labelClass } from "@/components/ui";

// ───────────── Types & helpers (mirror the server's perspectivesSchema) ─────────────

export type Side = "left" | "right";
export type PerspectiveArg = { text: string; sourceIds?: string[] };
export type PerspectiveData = { side: Side; summary: string; arguments: PerspectiveArg[]; framing: string; values: string[] };

export const SIDES: Side[] = ["left", "right"];
export const SIDE_LABEL: Record<Side, string> = { left: "Left", right: "Right" };
export const MAX_ARGUMENTS = 8;
export const MAX_VALUES = 6;

export const emptyPerspective = (side: Side): PerspectiveData => ({ side, summary: "", arguments: [{ text: "" }], framing: "", values: [] });

/** Always returns both sides, left first, filling a missing side with an empty one. */
export function bothSides(ps: PerspectiveData[]): PerspectiveData[] {
  return SIDES.map((side) => ps.find((p) => p.side === side) ?? emptyPerspective(side));
}

/** Trims text and drops empty arguments/values, as the API expects. */
export function cleanPerspectives(ps: PerspectiveData[]): PerspectiveData[] {
  if (!ps.length) return [];
  return bothSides(ps).map((p) => ({
    side: p.side,
    summary: p.summary.trim(),
    arguments: p.arguments
      .map((a) => ({ text: a.text.trim(), ...(a.sourceIds?.length ? { sourceIds: a.sourceIds } : {}) }))
      .filter((a) => a.text)
      .slice(0, MAX_ARGUMENTS),
    framing: p.framing.trim(),
    values: [...new Set(p.values.map((v) => v.trim()).filter(Boolean))].slice(0, MAX_VALUES),
  }));
}

/** Same rules as the server's `perspectiveProblems`: both sides or neither, each with a summary and ≥1 argument. */
export function perspectiveIssues(ps: PerspectiveData[]): { side: Side; text: string; blocksSave: boolean }[] {
  if (!ps.length) return [];
  const out: { side: Side; text: string; blocksSave: boolean }[] = [];
  // A side missing from stored data is shown (and saved) as an empty one, so it is checked like any other.
  for (const p of bothSides(ps)) {
    const side = p.side;
    const name = SIDE_LABEL[side];
    // The API rejects an empty summary outright, so that one blocks saving.
    if (!p.summary.trim()) out.push({ side, text: `${name}: write a summary`, blocksSave: true });
    if (!p.arguments.some((a) => a.text.trim())) out.push({ side, text: `${name}: add at least one argument`, blocksSave: false });
  }
  return out;
}

/** Coerces stored/AI JSON into editor-friendly perspectives. */
export function toPerspectives(x: unknown): PerspectiveData[] {
  if (!Array.isArray(x)) return [];
  const out: PerspectiveData[] = [];
  for (const raw of x) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (o.side !== "left" && o.side !== "right") continue;
    if (out.some((p) => p.side === o.side)) continue;
    out.push({
      side: o.side,
      summary: typeof o.summary === "string" ? o.summary : "",
      arguments: Array.isArray(o.arguments)
        ? o.arguments
            .filter((a): a is { text: string; sourceIds?: unknown } => !!a && typeof a === "object" && typeof (a as { text?: unknown }).text === "string")
            .map((a) => ({ text: a.text, ...(Array.isArray(a.sourceIds) ? { sourceIds: a.sourceIds.filter((s): s is string => typeof s === "string") } : {}) }))
        : [],
      framing: typeof o.framing === "string" ? o.framing : "",
      values: Array.isArray(o.values) ? o.values.filter((v): v is string => typeof v === "string") : [],
    });
  }
  return out.sort((a, b) => SIDES.indexOf(a.side) - SIDES.indexOf(b.side));
}

// ───────────── Editor panel ─────────────

type SourceOpt = { id: string; publisherName: string; originalHeadline: string | null };

export function PerspectivesEditor({
  value,
  onChange,
  sources,
  disabled,
}: {
  value: PerspectiveData[];
  onChange: (v: PerspectiveData[]) => void;
  sources: SourceOpt[];
  disabled?: boolean;
}) {
  const has = value.length > 0;
  const sides = has ? bothSides(value) : [];
  const issues = perspectiveIssues(value);
  const update = (side: Side, p: PerspectiveData) => onChange(bothSides(value).map((x) => (x.side === side ? p : x)));

  return (
    <section aria-labelledby="persp-title" className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="persp-title" className="font-semibold">Left / Right perspectives</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            Optional, but never one-sided: both sides are added or removed together. Write each side in its own best terms, attributed, with comparable depth. Readers see these only after they rate.
          </p>
        </div>
        {!disabled &&
          (has ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Remove both perspectives from this story? (Nothing is saved until you press Save.)")) onChange([]);
              }}
            >
              Remove perspectives
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => onChange(SIDES.map(emptyPerspective))}>
              Add perspectives
            </Button>
          ))}
      </div>

      {has && (
        <>
          <div aria-live="polite" className="mt-3">
            {issues.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn" aria-label="Perspective problems">
                {issues.map((i) => (
                  <li key={i.text}>
                    {i.text}
                    {i.blocksSave && <span className="font-normal"> (required to save)</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {sides.map((p) => (
              <SideEditor key={p.side} p={p} onChange={(np) => update(p.side, np)} sources={sources} disabled={disabled} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SideEditor({ p, onChange, sources, disabled }: { p: PerspectiveData; onChange: (p: PerspectiveData) => void; sources: SourceOpt[]; disabled?: boolean }) {
  const name = SIDE_LABEL[p.side];
  const id = `persp-${p.side}`;
  const set = <K extends keyof PerspectiveData>(k: K, v: PerspectiveData[K]) => onChange({ ...p, [k]: v });
  const setArg = (i: number, a: PerspectiveArg) => set("arguments", p.arguments.map((x, j) => (j === i ? a : x)));
  const known = new Set(sources.map((s) => s.id));

  return (
    <fieldset disabled={disabled} className="min-w-0 rounded-xl border border-line bg-surface-2 p-3">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wider text-ink-2">{name}</legend>

      <label htmlFor={`${id}-summary`} className={labelClass}>Summary</label>
      <textarea
        id={`${id}-summary`}
        rows={3}
        maxLength={600}
        className={`${inputClass} text-sm`}
        value={p.summary}
        onChange={(e) => set("summary", e.target.value)}
        aria-invalid={!p.summary.trim() || undefined}
        aria-describedby={`${id}-summary-help`}
      />
      <p id={`${id}-summary-help`} className="mt-1 text-xs text-ink-3">How the {name.toLowerCase()} describes the issue and its position, attributed. Required.</p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Arguments <span className="font-normal text-ink-3">({p.arguments.length}/{MAX_ARGUMENTS})</span></legend>
        <ol className="mt-2 space-y-3">
          {p.arguments.map((a, i) => {
            const stale = (a.sourceIds ?? []).filter((s) => !known.has(s));
            return (
              <li key={i} className="rounded-lg border border-line bg-surface p-2.5">
                <div className="flex items-start gap-2">
                  <label htmlFor={`${id}-arg-${i}`} className="sr-only">{name} argument {i + 1}</label>
                  <textarea id={`${id}-arg-${i}`} rows={2} maxLength={600} className={`${inputClass} text-sm`} value={a.text} onChange={(e) => setArg(i, { ...a, text: e.target.value })} />
                  <Button type="button" variant="ghost" className="shrink-0 px-3" onClick={() => set("arguments", p.arguments.filter((_, j) => j !== i))} aria-label={`Remove ${name.toLowerCase()} argument ${i + 1}`}>
                    Remove
                  </Button>
                </div>
                {sources.length > 0 ? (
                  <fieldset className="mt-2">
                    <legend className="text-xs font-semibold text-ink-2">Linked sources</legend>
                    <ul className="mt-1 space-y-0.5">
                      {sources.map((s) => {
                        const checked = !!a.sourceIds?.includes(s.id);
                        return (
                          <li key={s.id}>
                            <label className="flex min-h-9 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="size-4 shrink-0"
                                checked={checked}
                                onChange={(e) => {
                                  const cur = a.sourceIds ?? [];
                                  const next = e.target.checked ? [...cur, s.id].slice(0, 10) : cur.filter((x) => x !== s.id);
                                  setArg(i, { ...a, sourceIds: next });
                                }}
                              />
                              <span className="min-w-0 truncate">
                                {s.publisherName}
                                {s.originalHeadline && <span className="text-ink-3"> — {s.originalHeadline}</span>}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                ) : (
                  <p className="mt-1 text-xs text-ink-3">Attach sources to link them to arguments.</p>
                )}
                {stale.length > 0 && (
                  <p className="mt-1 text-xs text-ink-3">
                    Also linked to {stale.length} source{stale.length === 1 ? "" : "s"} not attached to this version.{" "}
                    <button type="button" className="underline" onClick={() => setArg(i, { ...a, sourceIds: (a.sourceIds ?? []).filter((s) => known.has(s)) })}>
                      Clear<span className="sr-only"> stale links on {name.toLowerCase()} argument {i + 1}</span>
                    </button>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {p.arguments.length < MAX_ARGUMENTS && (
          <Button type="button" variant="secondary" className="mt-2" onClick={() => set("arguments", [...p.arguments, { text: "" }])}>
            Add {name.toLowerCase()} argument
          </Button>
        )}
      </fieldset>

      <label htmlFor={`${id}-framing`} className={`${labelClass} mt-4`}>How they frame it</label>
      <textarea id={`${id}-framing`} rows={2} maxLength={600} className={`${inputClass} text-sm`} value={p.framing} onChange={(e) => set("framing", e.target.value)} aria-describedby={`${id}-framing-help`} />
      <p id={`${id}-framing-help`} className="mt-1 text-xs text-ink-3">Words and framing this side tends to use for the issue.</p>

      <ValuesInput id={`${id}-values`} side={name} values={p.values} onChange={(v) => set("values", v)} />
    </fieldset>
  );
}

function ValuesInput({ id, side, values, onChange }: { id: string; side: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const full = values.length >= MAX_VALUES;
  function commit() {
    const parts = draft.split(",").map((s) => s.trim().slice(0, 40)).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (next.length < MAX_VALUES && !next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  }
  return (
    <div className="mt-4">
      <label htmlFor={id} className={labelClass}>Values <span className="font-normal text-ink-3">({values.length}/{MAX_VALUES})</span></label>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={`${side} values`}>
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-3 pr-1 text-sm">
              {v}
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove value ${v} from ${side.toLowerCase()}`}>
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className={`${inputClass} text-sm`}
          value={draft}
          maxLength={200}
          disabled={full}
          placeholder={full ? "Maximum reached" : "e.g. fairness, liberty"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          aria-describedby={`${id}-help`}
        />
        <Button type="button" variant="secondary" className="shrink-0" disabled={full || !draft.trim()} onClick={commit}>
          Add<span className="sr-only"> {side.toLowerCase()} value</span>
        </Button>
      </div>
      <p id={`${id}-help`} className="mt-1 text-xs text-ink-3">Press Enter or comma to add. Up to {MAX_VALUES}.</p>
    </div>
  );
}

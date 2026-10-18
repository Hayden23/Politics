"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { LEAN_LABELS, type Lean } from "@/domain/lean";
import { Button, inputClass, labelClass } from "@/components/ui";
import { StatusLine, useMutation } from "./useMutation";

const LEANS = Object.keys(LEAN_LABELS) as Lean[];

export type PublisherRow = { id: string; name: string; domain: string | null; lean: Lean; leanBasis: string | null; notes: string | null };

type Form = { name: string; domain: string; lean: Lean; leanBasis: string; notes: string };
const toForm = (p?: PublisherRow): Form => ({ name: p?.name ?? "", domain: p?.domain ?? "", lean: p?.lean ?? "unrated", leanBasis: p?.leanBasis ?? "", notes: p?.notes ?? "" });

function PublisherFields({ idp, f, setF }: { idp: string; f: Form; setF: (f: Form) => void }) {
  const bind = (k: keyof Form) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }),
  });
  const basisRequired = f.lean !== "unrated";
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idp}-name`} className={labelClass}>Outlet name</label>
          <input id={`${idp}-name`} required maxLength={200} className={inputClass} {...bind("name")} />
        </div>
        <div>
          <label htmlFor={`${idp}-domain`} className={labelClass}>Domain <span className="font-normal text-ink-3">(optional)</span></label>
          <input id={`${idp}-domain`} maxLength={253} placeholder="example.com" inputMode="url" className={inputClass} {...bind("domain")} aria-describedby={`${idp}-domain-help`} />
          <p id={`${idp}-domain-help`} className="mt-1 text-xs text-ink-3">Used to match sources and candidates to this outlet.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idp}-lean`} className={labelClass}>Lean</label>
          <select id={`${idp}-lean`} className={inputClass} {...bind("lean")}>
            {LEANS.map((l) => <option key={l} value={l}>{LEAN_LABELS[l]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idp}-basis`} className={labelClass}>
            Basis {basisRequired ? <span className="font-normal text-ink-3">(required)</span> : <span className="font-normal text-ink-3">(optional when not rated)</span>}
          </label>
          <input id={`${idp}-basis`} required={basisRequired} maxLength={300} placeholder="e.g. Named rating service, 2026 chart" className={inputClass} {...bind("leanBasis")} aria-describedby={`${idp}-basis-help`} />
          <p id={`${idp}-basis-help`} className="mt-1 text-xs text-ink-3">Cite where the rating comes from.</p>
        </div>
      </div>
      <div>
        <label htmlFor={`${idp}-notes`} className={labelClass}>Notes <span className="font-normal text-ink-3">(internal, optional)</span></label>
        <textarea id={`${idp}-notes`} rows={2} maxLength={1000} className={inputClass} {...bind("notes")} />
      </div>
    </div>
  );
}

function payload(f: Form) {
  return {
    name: f.name.trim(),
    domain: f.domain.trim() ? f.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") : null,
    lean: f.lean,
    leanBasis: f.leanBasis.trim() || null,
    notes: f.notes.trim() || null,
  };
}

/** One table row plus, when editing, a full-width row holding the inline form. */
export function PublisherTableRow({ publisher, sourceCount, tdClass }: { publisher: PublisherRow; sourceCount: number; tdClass: string }) {
  const m = useMutation();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(toForm(publisher));
  const formId = `pub-edit-${publisher.id}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.lean !== "unrated" && !f.leanBasis.trim()) return m.setError("Say what the lean rating is based on.");
    const ok = await m.run(() => api(`/api/admin/publishers/${publisher.id}`, { method: "PATCH", body: payload(f) }), { success: `Saved ${f.name.trim()}.` });
    if (ok) setOpen(false);
  }

  return (
    <>
      <tr id={`publisher-${publisher.id}`} className="scroll-mt-24 target:bg-accent-soft">
        <td className={tdClass}>
          <span className="font-semibold">{publisher.name}</span>
          {publisher.notes && <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{publisher.notes}</p>}
        </td>
        <td className={`${tdClass} break-all text-ink-2`}>{publisher.domain ?? <span className="text-ink-3">—</span>}</td>
        <td className={`${tdClass} whitespace-nowrap`}>{LEAN_LABELS[publisher.lean]}</td>
        <td className={`${tdClass} text-ink-2`}>{publisher.leanBasis ?? <span className="text-ink-3">—</span>}</td>
        <td className={`${tdClass} tabular-nums`}>{sourceCount}</td>
        <td className={tdClass}>
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 px-3 py-1.5"
            aria-expanded={open}
            aria-controls={formId}
            onClick={() => {
              if (!open) setF(toForm(publisher));
              m.setError(null);
              setOpen((o) => !o);
            }}
          >
            {open ? "Close" : "Edit"}<span className="sr-only"> {publisher.name}</span>
          </Button>
          {!open && <StatusLine className="mt-1" error={m.error} message={m.message} />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className={`${tdClass} bg-surface-2`}>
            <form id={formId} onSubmit={submit} className="max-w-2xl space-y-3" aria-label={`Edit ${publisher.name}`}>
              <PublisherFields idp={formId} f={f} setF={setF} />
              <div className="flex gap-2">
                <Button type="submit" disabled={m.busy}>{m.busy ? "Saving…" : "Save outlet"}</Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
              <StatusLine error={m.error} message={m.message} />
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

export function AddPublisher() {
  const m = useMutation();
  const [f, setF] = useState<Form>(toForm());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.lean !== "unrated" && !f.leanBasis.trim()) return m.setError("Say what the lean rating is based on.");
    const ok = await m.run(() => api("/api/admin/publishers", { body: payload(f) }), { success: `Added ${f.name.trim()}. Existing sources from its domain are now linked to it.` });
    if (ok) setF(toForm());
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Add an outlet">
      <PublisherFields idp="pub-new" f={f} setF={setF} />
      <Button type="submit" disabled={m.busy}>{m.busy ? "Adding…" : "Add outlet"}</Button>
      <StatusLine error={m.error} message={m.message} />
    </form>
  );
}

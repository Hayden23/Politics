"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, inputClass, labelClass } from "@/components/ui";
import { StatusLine, useMutation } from "./useMutation";

export function AddCandidateForm() {
  const m = useMutation();
  const [f, setF] = useState({ title: "", url: "", publisherName: "", summary: "" });
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value })) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const out = await m.run(
      () => api<{ id: string; duplicateOf: string | null }>("/api/admin/candidates", { body: { title: f.title, url: f.url, publisherName: f.publisherName.trim() || undefined, summary: f.summary.trim() || undefined } }),
      { success: "Candidate added." },
    );
    if (out) {
      setF({ title: "", url: "", publisherName: "", summary: "" });
      if (out.duplicateOf) m.setMessage("Candidate added. It looks similar to an existing lead — check the duplicate badge.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="cand-title" className={labelClass}>Title</label>
        <input id="cand-title" required minLength={5} maxLength={400} className={inputClass} {...bind("title")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cand-url" className={labelClass}>URL</label>
          <input id="cand-url" type="url" required maxLength={2000} placeholder="https://" className={inputClass} {...bind("url")} />
        </div>
        <div>
          <label htmlFor="cand-pub" className={labelClass}>Publisher <span className="font-normal text-ink-3">(optional)</span></label>
          <input id="cand-pub" maxLength={200} className={inputClass} {...bind("publisherName")} />
        </div>
      </div>
      <div>
        <label htmlFor="cand-sum" className={labelClass}>Summary <span className="font-normal text-ink-3">(optional)</span></label>
        <textarea id="cand-sum" rows={3} maxLength={2000} className={inputClass} {...bind("summary")} />
      </div>
      <Button type="submit" disabled={m.busy}>{m.busy ? "Adding…" : "Add candidate"}</Button>
      <StatusLine error={m.error} message={m.message} />
    </form>
  );
}

export function CandidateActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const m = useMutation();

  async function promote() {
    const out = await m.run(() => api<{ storyId: string }>(`/api/admin/candidates/${id}/promote`, { body: {} }), { refresh: false, success: "Draft created. Opening the editor…" });
    if (out) router.push(`/admin/stories/${out.storyId}`);
  }
  async function dismiss() {
    await m.run(() => api(`/api/admin/candidates/${id}/dismiss`, { body: {} }), { success: "Dismissed." });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={m.busy} onClick={promote}>Promote<span className="sr-only"> “{title}”</span> to draft</Button>
        <Button type="button" variant="ghost" disabled={m.busy} onClick={dismiss}>Dismiss<span className="sr-only"> “{title}”</span></Button>
      </div>
      <StatusLine className="mt-1" error={m.error} message={m.message} />
    </div>
  );
}

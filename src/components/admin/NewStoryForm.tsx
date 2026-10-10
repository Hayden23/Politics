"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, inputClass, labelClass } from "@/components/ui";
import { StatusLine, useMutation } from "./useMutation";

export function NewStoryForm({ topics }: { topics: { id: string; name: string }[] }) {
  const router = useRouter();
  const m = useMutation();
  const [headline, setHeadline] = useState("");
  const [topicId, setTopicId] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [priority, setPriority] = useState(0);
  const [briefing, setBriefing] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const out = await m.run(
      () =>
        api<{ id: string }>("/api/admin/stories", {
          body: { headline, briefing, keyFacts: [], disputedClaims: [], uncertainties: [], topicId: topicId || null, eventAt: eventAt || null, editorialPriority: priority },
        }),
      { refresh: false, success: "Created. Opening the editor…" },
    );
    if (out) router.push(`/admin/stories/${out.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="ns-headline" className={labelClass}>Headline</label>
        <input id="ns-headline" className={inputClass} required minLength={8} maxLength={160} value={headline} onChange={(e) => setHeadline(e.target.value)} aria-describedby="ns-headline-help" />
        <p id="ns-headline-help" className="mt-1 text-xs text-ink-3">Neutral and source-blind: no publisher names or loaded wording.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="ns-topic" className={labelClass}>Topic</label>
          <select id="ns-topic" className={inputClass} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Choose later</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ns-event" className={labelClass}>Event date</label>
          <input id="ns-event" type="date" className={inputClass} value={eventAt} onChange={(e) => setEventAt(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ns-priority" className={labelClass}>Editorial priority</label>
          <input id="ns-priority" type="number" min={-10} max={10} step={1} className={inputClass} value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} />
        </div>
      </div>
      <div>
        <label htmlFor="ns-briefing" className={labelClass}>Briefing <span className="font-normal text-ink-3">(optional now)</span></label>
        <textarea id="ns-briefing" rows={6} className={inputClass} maxLength={4000} value={briefing} onChange={(e) => setBriefing(e.target.value)} />
      </div>
      <StatusLine error={m.error} message={m.message} />
      <Button type="submit" disabled={m.busy}>{m.busy ? "Creating…" : "Create draft"}</Button>
    </form>
  );
}

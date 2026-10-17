"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Card, labelClass, inputClass } from "@/components/ui";
import { formatDateTime } from "./bits";
import { StatusLine, useMutation } from "./useMutation";

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → value for <input type="datetime-local"> in the browser's own time zone. */
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localLabel(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZoneName: "short" });
}

export function SchedulePanel({ storyId, status, scheduledPublishAt, dirty }: { storyId: string; status: string; scheduledPublishAt: string | null; dirty: boolean }) {
  const m = useMutation();
  const [value, setValue] = useState("");
  const [min, setMin] = useState<string | undefined>(undefined);
  const [tz, setTz] = useState<string>("");

  // Local times depend on the browser, so derive them after mount to avoid hydration mismatches.
  useEffect(() => {
    const now = new Date();
    setMin(toLocalInput(now));
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setValue(scheduledPublishAt ? toLocalInput(new Date(scheduledPublishAt)) : toLocalInput(new Date(now.getTime() + 60 * 60_000)));
  }, [scheduledPublishAt]);

  if (status !== "approved" && !scheduledPublishAt) return null;

  const picked = value ? new Date(value) : null;
  const valid = !!picked && !isNaN(+picked);
  const inPast = valid && picked!.getTime() < Date.now();

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await m.run(() => api(`/api/admin/stories/${storyId}/schedule`, { body: { at: picked!.toISOString() } }), { success: `Scheduled for ${formatDateTime(picked!)}.` });
  }
  async function cancel() {
    await m.run(() => api(`/api/admin/stories/${storyId}/schedule`, { body: { at: null } }), { success: "Schedule cancelled. The story stays approved." });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Schedule publication</h2>
      {scheduledPublishAt ? (
        <p className="mt-2 text-sm">
          <Badge tone="accent">Scheduled</Badge>{" "}
          <span className="font-semibold">{formatDateTime(scheduledPublishAt)}</span>
          {tz && <span className="block text-ink-2">Your time: {localLabel(new Date(scheduledPublishAt))}</span>}
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-2">Publishes automatically as you, if you still hold editor access at that time. Any edit clears the schedule along with the approval.</p>
      )}
      {status !== "approved" && scheduledPublishAt && <p className="mt-2 text-sm text-warn">This story is no longer approved, so it won't publish on schedule.</p>}

      {status === "approved" && (
        <form onSubmit={schedule} className="mt-3 space-y-2">
          <label htmlFor="sched-at" className={labelClass}>
            {scheduledPublishAt ? "Change time" : "Publish at"} <span className="font-normal text-ink-3">(your local time{tz ? `, ${tz}` : ""})</span>
          </label>
          <input id="sched-at" type="datetime-local" required className={inputClass} min={min} value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="sched-utc" />
          <p id="sched-utc" className={`text-sm ${inPast ? "text-warn" : "text-ink-2"}`} aria-live="polite">
            {valid ? <>= {formatDateTime(picked!)}{inPast ? " — that's in the past" : ""}</> : "Pick a date and time."}
          </p>
          {dirty && <p className="text-sm text-warn">You have unsaved edits. Saving them will clear the approval and any schedule.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={m.busy || !valid || inPast}>{m.busy ? "Saving…" : scheduledPublishAt ? "Reschedule" : "Schedule"}</Button>
            {scheduledPublishAt && (
              <Button type="button" variant="secondary" disabled={m.busy} onClick={cancel}>Cancel schedule</Button>
            )}
          </div>
          <p className="text-xs text-ink-3">“Publish” in the workflow panel still publishes immediately.</p>
        </form>
      )}
      {status !== "approved" && scheduledPublishAt && (
        <Button type="button" variant="secondary" className="mt-3" disabled={m.busy} onClick={cancel}>Cancel schedule</Button>
      )}
      <StatusLine className="mt-2" error={m.error} message={m.message} />
    </Card>
  );
}

"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button, inputClass, labelClass } from "@/components/ui";
import { StatusLine, useMutation } from "./useMutation";

const USER_ACTIONS = [
  ["dismiss", "Dismiss — no violation"],
  ["remove_content", "Remove content"],
  ["warn", "Warn the author"],
  ["restrict", "Restrict commenting"],
  ["suspend", "Suspend account"],
  ["escalate", "Escalate"],
] as const;
const STORY_ACTIONS = [
  ["resolve_editorial", "Resolved editorially (story corrected or confirmed)"],
  ["dismiss", "Dismiss"],
  ["escalate", "Escalate"],
] as const;

export function ResolveReportForm({ reportId, targetType }: { reportId: string; targetType: "comment" | "story" | "user" }) {
  const m = useMutation();
  const options = targetType === "story" ? STORY_ACTIONS : targetType === "user" ? USER_ACTIONS.filter(([a]) => a !== "remove_content") : USER_ACTIONS;
  const [action, setAction] = useState<string>(options[0][0]);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);
  const severe = action === "suspend" || action === "restrict" || action === "remove_content";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (action === "suspend" && !window.confirm("Suspend this account? The user will be signed out and can only appeal.")) return;
    await m.run(() => api(`/api/admin/reports/${reportId}/resolve`, { body: { action, reason, ...(action === "restrict" ? { restrictDays: days } : {}) } }), { success: "Recorded." });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div>
          <label htmlFor={`act-${reportId}`} className={labelClass}>Action</label>
          <select id={`act-${reportId}`} className={inputClass} value={action} onChange={(e) => setAction(e.target.value)}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {action === "restrict" && (
          <div>
            <label htmlFor={`days-${reportId}`} className={labelClass}>Days</label>
            <input id={`days-${reportId}`} type="number" min={1} max={365} required className={inputClass} value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Math.trunc(Number(e.target.value) || 1))))} />
          </div>
        )}
      </div>
      <div>
        <label htmlFor={`reason-${reportId}`} className={labelClass}>Reason (recorded and shown to the user on enforcement)</label>
        <textarea id={`reason-${reportId}`} rows={2} required minLength={5} maxLength={1000} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Which guideline, and how this content breaks it" />
      </div>
      <Button type="submit" variant={severe ? "danger" : "primary"} disabled={m.busy || reason.trim().length < 5}>
        {m.busy ? "Saving…" : "Record decision"}
      </Button>
      <StatusLine error={m.error} message={m.message} />
    </form>
  );
}

export function AppealForm({ appealId }: { appealId: string }) {
  const m = useMutation();
  const [resolution, setResolution] = useState("");

  async function decide(decision: "upheld" | "overturned") {
    if (resolution.trim().length < 5) return m.setError("Write a resolution of at least 5 characters.");
    await m.run(() => api(`/api/admin/appeals/${appealId}/resolve`, { body: { decision, resolution } }), { success: decision === "upheld" ? "Original decision upheld." : "Decision overturned." });
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <div>
        <label htmlFor={`res-${appealId}`} className={labelClass}>Resolution (shared with the user)</label>
        <textarea id={`res-${appealId}`} rows={2} required minLength={5} maxLength={1000} className={inputClass} value={resolution} onChange={(e) => setResolution(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={m.busy} onClick={() => decide("upheld")}>Uphold original decision</Button>
        <Button type="button" disabled={m.busy} onClick={() => decide("overturned")}>Overturn and reinstate</Button>
      </div>
      <StatusLine error={m.error} message={m.message} />
    </form>
  );
}

export function RoleSelect({ userId, role, name, self }: { userId: string; role: string; name: string; self: boolean }) {
  const m = useMutation();
  const [value, setValue] = useState(role);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Change ${name}'s role to ${value}? They will be signed out.`)) return;
    await m.run(() => api(`/api/admin/users/${userId}/role`, { body: { role: value } }), { success: "Role updated." });
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`role-${userId}`} className="sr-only">Role for {name}</label>
        <select id={`role-${userId}`} className={`${inputClass} w-36`} value={value} onChange={(e) => setValue(e.target.value)} disabled={m.busy}>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="editor">Editor</option>
          <option value="admin" >Admin</option>
        </select>
      </div>
      <Button type="submit" variant="secondary" disabled={m.busy || value === role || (self && value !== "admin")}>
        Save<span className="sr-only"> role for {name}</span>
      </Button>
      <StatusLine className="w-full" error={m.error} message={m.message} />
    </form>
  );
}

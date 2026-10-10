"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, inputClass, labelClass } from "@/components/ui";
import { DemographicsFields, demoPayload, toDemo, type Demo } from "@/components/DemographicsFields";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "saved"; text?: string } | { kind: "error"; text: string };

function useSave() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const router = useRouter();
  async function save(fn: () => Promise<unknown>, savedText?: string) {
    setStatus({ kind: "busy" });
    try {
      await fn();
      setStatus({ kind: "saved", text: savedText });
      router.refresh();
      return true;
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
      return false;
    }
  }
  return { status, save, setStatus };
}

function StatusLine({ status, id }: { status: Status; id: string }) {
  if (status.kind === "error") return <p id={id} role="alert" className="mt-2 text-sm text-danger">{status.text}</p>;
  return (
    <p id={id} role="status" className="mt-2 min-h-5 text-sm text-ink-2">
      {status.kind === "saved" ? (status.text ?? "Saved.") : ""}
    </p>
  );
}

// ───────────── Display name ─────────────

export function DisplayNameForm({ initial }: { initial: string }) {
  const id = useId();
  const [name, setName] = useState(initial);
  const { status, save } = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => api("/api/me/settings", { method: "PATCH", body: { displayName: name.trim() } }));
      }}
    >
      <label htmlFor={`${id}-name`} className={labelClass}>Display name</label>
      <p id={`${id}-hint`} className="-mt-1 mb-1.5 text-xs text-ink-3">Shown next to your comments. 2–40 characters: letters, numbers, spaces, . _ or -</p>
      <div className="flex gap-2">
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={40}
          required
          autoComplete="nickname"
          aria-describedby={`${id}-hint ${id}-status`}
          aria-invalid={status.kind === "error" || undefined}
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={status.kind === "busy" || name.trim() === initial || name.trim().length < 2}>Save</Button>
      </div>
      <StatusLine status={status} id={`${id}-status`} />
    </form>
  );
}

// ───────────── Topics ─────────────

export function TopicsForm({ topics, initial }: { topics: { slug: string; name: string }[]; initial: string[] }) {
  const id = useId();
  const [picked, setPicked] = useState<string[]>(initial);
  const { status, save } = useSave();
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => api("/api/me/settings", { method: "PATCH", body: { topics: picked } }));
      }}
    >
      <fieldset aria-describedby={`${id}-status`}>
        <legend className={labelClass}>Topics you care about</legend>
        <p className="-mt-1 mb-2 text-xs text-ink-3">Used to suggest briefings. You'll still see every topic.</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {topics.map((t) => (
            <label key={t.slug} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
              <input type="checkbox" checked={picked.includes(t.slug)} onChange={() => toggle(t.slug)} className="size-5 accent-[var(--ink)]" />
              <span className="text-sm">{t.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" variant="secondary" className="mt-3" disabled={status.kind === "busy"}>Save topics</Button>
      <StatusLine status={status} id={`${id}-status`} />
    </form>
  );
}

// ───────────── Notifications ─────────────

export function NotificationsForm({ initial }: { initial: "off" | "daily" | "weekly" }) {
  const id = useId();
  const [freq, setFreq] = useState(initial);
  const { status, save } = useSave();
  const opts = [
    ["off", "Never"],
    ["daily", "Daily"],
    ["weekly", "Weekly"],
  ] as const;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => api("/api/me/settings", { method: "PATCH", body: { notificationFrequency: freq } }));
      }}
    >
      <fieldset aria-describedby={`${id}-status`}>
        <legend className={labelClass}>How often we may email you a digest</legend>
        <div className="flex flex-wrap gap-2">
          {opts.map(([v, l]) => (
            <label key={v} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm ${freq === v ? "border-ink bg-surface-2 font-semibold" : "border-line"}`}>
              <input type="radio" name={`${id}-freq`} value={v} checked={freq === v} onChange={() => setFreq(v)} className="size-4 accent-[var(--ink)]" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" variant="secondary" className="mt-3" disabled={status.kind === "busy" || freq === initial}>Save</Button>
      <StatusLine status={status} id={`${id}-status`} />
    </form>
  );
}

// ───────────── Privacy ─────────────

export function PrivacyToggle({ initial }: { initial: boolean }) {
  const id = useId();
  const [on, setOn] = useState(initial);
  const { status, save } = useSave();
  async function toggle() {
    const next = !on;
    setOn(next);
    const ok = await save(() => api("/api/me/settings", { method: "PATCH", body: { showRatingOnComments: next } }), next ? "Your answer will appear next to your comments." : "Your answer is hidden from your comments.");
    if (!ok) setOn(!next);
  }
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id={`${id}-label`} className="font-semibold">Show my answer next to my comments</p>
          <p id={`${id}-desc`} className="mt-0.5 text-sm text-ink-2">
            Off by default. When on, people in a discussion see your answer (for example “Somewhat support”) beside what you wrote, and your comments can appear under “Different responses”. Your ratings are never shown anywhere else.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-desc ${id}-status`}
          disabled={status.kind === "busy"}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition ${on ? "border-ink bg-ink" : "border-line bg-surface-2"}`}
        >
          <span aria-hidden className={`inline-block size-6 rounded-full bg-surface shadow transition ${on ? "translate-x-6" : "translate-x-0.5"}`} />
          <span className="sr-only">{on ? "On" : "Off"}</span>
        </button>
      </div>
      <StatusLine status={status} id={`${id}-status`} />
    </div>
  );
}

// ───────────── Demographics ─────────────

export function DemographicsForm({ initial }: { initial: Partial<Record<keyof Demo, string | null>> | null }) {
  const id = useId();
  const [consent, setConsent] = useState(!!initial);
  const [demo, setDemo] = useState<Demo>(toDemo(initial));
  const { status, save } = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          () => api("/api/me/demographics", { method: "PUT", body: { consent, demographics: consent ? demoPayload(demo) : {} } }),
          consent ? "Saved." : "Demographic details deleted.",
        );
        if (!consent) setDemo(toDemo(null));
      }}
    >
      <p className="text-sm text-ink-2">
        Entirely optional. If you share these, they're stored separately from your account details and used only to produce aggregate breakdowns when enough people have answered. They're never shown on your profile or comments.
      </p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby={`${id}-consent-desc`} className="mt-0.5 size-5 shrink-0 accent-[var(--ink)]" />
        <span>
          <span className="text-sm font-semibold">I consent to storing these optional details</span>
          <span id={`${id}-consent-desc`} className="block text-xs text-ink-3">Unchecking and saving deletes anything you've shared. You can change this anytime.</span>
        </span>
      </label>
      <div className="mt-3">
        <DemographicsFields value={demo} onChange={setDemo} disabled={!consent} idPrefix={`${id}-d`} />
      </div>
      <Button type="submit" variant="secondary" className="mt-4" disabled={status.kind === "busy"}>
        {consent ? "Save details" : initial ? "Delete my details" : "Save"}
      </Button>
      <StatusLine status={status} id={`${id}-status`} />
    </form>
  );
}

// ───────────── Blocked users ─────────────

export function BlockedList({ users }: { users: { id: string; name: string | null; since: string }[] }) {
  const { status, save } = useSave();
  const id = useId();
  if (!users.length) return <p className="text-sm text-ink-2">You haven't blocked anyone.</p>;
  return (
    <div>
      <ul className="divide-y divide-line">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 py-2">
            <span>{u.name ?? "Deleted account"}</span>
            <Button variant="ghost" disabled={status.kind === "busy"} onClick={() => save(() => api(`/api/users/${u.id}/block`, { method: "DELETE" }), `Unblocked ${u.name ?? "user"}.`)} aria-label={`Unblock ${u.name ?? "user"}`}>
              Unblock
            </Button>
          </li>
        ))}
      </ul>
      <StatusLine status={status} id={`${id}-status`} />
    </div>
  );
}

// ───────────── Account standing ─────────────

const ACTION_LABEL: Record<string, string> = {
  remove_content: "A comment was removed",
  warn: "Warning",
  restrict: "Posting restricted",
  suspend: "Account suspended",
};
const APPEAL_LABEL: Record<string, string> = { open: "Appeal under review", upheld: "Appeal reviewed — decision upheld", overturned: "Appeal reviewed — decision overturned" };

export type Enforcement = {
  id: string;
  action: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  appeal: { status: string; resolution: string | null; createdAt: string } | null;
};

export function StandingList({ items }: { items: Enforcement[] }) {
  if (!items.length) return <p className="text-sm text-ink-2">Your account is in good standing. There are no warnings, removals or restrictions on record.</p>;
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-xl border border-line p-4">
          <p className="font-semibold">{ACTION_LABEL[a.action] ?? a.action}</p>
          <p className="text-xs text-ink-3">
            {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {a.expiresAt && ` · until ${new Date(a.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
          </p>
          <p className="mt-1 text-sm text-ink-2">Reason: {a.reason}</p>
          {a.appeal ? (
            <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <p className="font-semibold">{APPEAL_LABEL[a.appeal.status] ?? a.appeal.status}</p>
              {a.appeal.resolution && <p className="mt-0.5 text-ink-2">{a.appeal.resolution}</p>}
            </div>
          ) : (
            <AppealForm actionId={a.id} />
          )}
        </li>
      ))}
    </ul>
  );
}

function AppealForm({ actionId }: { actionId: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const { status, save } = useSave();
  if (!open) {
    return (
      <Button variant="ghost" className="mt-2 -ml-2" onClick={() => setOpen(true)} aria-expanded={false}>
        Appeal this decision
      </Button>
    );
  }
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(() => api("/api/me/appeals", { body: { moderationActionId: actionId, body: body.trim() } }), "Appeal submitted. A different moderator will review it.");
      }}
    >
      <label htmlFor={`${id}-body`} className={labelClass}>Why should this decision be reconsidered?</label>
      <textarea
        id={`${id}-body`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        minLength={10}
        maxLength={2000}
        required
        aria-describedby={`${id}-count ${id}-status`}
        className="w-full rounded-xl border border-line bg-surface p-3 text-base"
      />
      <p id={`${id}-count`} className="text-xs text-ink-3">{body.length} / 2,000 · at least 10 characters</p>
      <div className="mt-2 flex gap-2">
        <Button type="submit" disabled={status.kind === "busy" || body.trim().length < 10}>Submit appeal</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <StatusLine status={status} id={`${id}-status`} />
    </form>
  );
}

// ───────────── Session & deletion ─────────────

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/auth/logout", { method: "POST" });
            router.push("/");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function DeleteAccount() {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <Button variant="danger" onClick={() => setOpen(true)}>Delete my account…</Button>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm !== "DELETE") return setError("Type DELETE in capital letters to confirm.");
        setBusy(true);
        setError(null);
        try {
          await api("/api/me/account", { method: "DELETE", body: { confirm } });
          router.push("/welcome");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-ink-2">
        This permanently deletes your ratings and their history, demographic details, preferences, saved stories, reactions, blocks and appeals, and signs you out everywhere. Your comments are replaced with “[deleted]”. This can't be undone — <a href="/api/me/export" download className="underline">download your data</a> first if you want a copy.
      </p>
      <label htmlFor={`${id}-confirm`} className={`${labelClass} mt-3`}>Type DELETE to confirm</label>
      <input
        id={`${id}-confirm`}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="off"
        aria-describedby={error ? `${id}-err` : undefined}
        aria-invalid={!!error || undefined}
        className={inputClass}
      />
      {error && <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={busy || confirm !== "DELETE"}>{busy ? "Deleting…" : "Permanently delete account"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

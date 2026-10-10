"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, inputClass, labelClass } from "@/components/ui";

type FieldErr = { field: string | null; text: string; suspended?: boolean };

export function GoogleButton({ next }: { next: string }) {
  return (
    <>
      <a
        href={`/api/auth/oauth/google?next=${encodeURIComponent(next)}`}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface font-semibold hover:bg-surface-2"
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 12h8" /></svg>
        Continue with Google
      </a>
      <p className="my-5 flex items-center gap-3 text-xs text-ink-3" aria-hidden>
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </p>
    </>
  );
}

export function LoginForm({ next }: { next: string }) {
  const id = useId();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FieldErr | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: string }>("/api/auth/login", { body: { email, password } });
      router.push(r.next === "/onboarding" ? `/onboarding?next=${encodeURIComponent(next)}` : next);
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError({ field: null, text: msg, suspended: /suspended/i.test(msg) });
      setBusy(false);
    }
  }

  const errId = `${id}-err`;
  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>Email</label>
          <input id={`${id}-email`} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={error ? errId : undefined} aria-invalid={!!error || undefined} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-pw`} className={labelClass}>Password</label>
          <input id={`${id}-pw`} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={error ? errId : undefined} aria-invalid={!!error || undefined} className={inputClass} />
        </div>
      </div>
      {error && (
        <p id={errId} role="alert" className="mt-3 text-sm text-danger">
          {error.suspended ? (
            <>This account is suspended. <Link href="/appeal" className="font-semibold underline">Appeal the suspension</Link>.</>
          ) : (
            error.text
          )}
        </p>
      )}
      <Button type="submit" className="mt-5 min-h-12 w-full text-base" disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const id = useId();
  const router = useRouter();
  const [f, setF] = useState({ displayName: "", email: "", password: "", acceptTerms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FieldErr | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  function validate(): FieldErr | null {
    if (f.displayName.trim().length < 2) return { field: "displayName", text: "Display name is too short" };
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return { field: "email", text: "Enter a valid email" };
    if (f.password.length < 10) return { field: "password", text: "Use at least 10 characters" };
    if (!f.acceptTerms) return { field: "acceptTerms", text: "You must accept the terms and privacy policy" };
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: string }>("/api/auth/signup", { body: f });
      const dest = r.next || "/onboarding";
      router.push(next !== "/" && dest === "/onboarding" ? `/onboarding?next=${encodeURIComponent(next)}` : dest);
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      const field = /email/i.test(msg) ? "email" : /password|characters/i.test(msg) ? "password" : /name/i.test(msg) ? "displayName" : /terms/i.test(msg) ? "acceptTerms" : null;
      setError({ field, text: msg });
      setBusy(false);
    }
  }

  const err = (k: string) => (error?.field === k ? <p id={`${id}-${k}-err`} role="alert" className="mt-1.5 text-sm text-danger">{error.text}</p> : null);
  const desc = (k: string, extra?: string) => [extra, error?.field === k ? `${id}-${k}-err` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-displayName`} className={labelClass}>Display name</label>
          <p id={`${id}-dn-hint`} className="-mt-1 mb-1.5 text-xs text-ink-3">Shown next to your comments. You can use a nickname.</p>
          <input id={`${id}-displayName`} autoComplete="nickname" maxLength={40} required value={f.displayName} onChange={set("displayName")} aria-describedby={desc("displayName", `${id}-dn-hint`)} aria-invalid={error?.field === "displayName" || undefined} className={inputClass} />
          {err("displayName")}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>Email</label>
          <input id={`${id}-email`} type="email" autoComplete="email" required value={f.email} onChange={set("email")} aria-describedby={desc("email")} aria-invalid={error?.field === "email" || undefined} className={inputClass} />
          {err("email")}
        </div>
        <div>
          <label htmlFor={`${id}-password`} className={labelClass}>Password</label>
          <p id={`${id}-pw-hint`} className="-mt-1 mb-1.5 text-xs text-ink-3">At least 10 characters.</p>
          <input id={`${id}-password`} type="password" autoComplete="new-password" minLength={10} required value={f.password} onChange={set("password")} aria-describedby={desc("password", `${id}-pw-hint`)} aria-invalid={error?.field === "password" || undefined} className={inputClass} />
          {err("password")}
        </div>
        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
            <input type="checkbox" required checked={f.acceptTerms} onChange={set("acceptTerms")} aria-describedby={desc("acceptTerms")} aria-invalid={error?.field === "acceptTerms" || undefined} className="mt-0.5 size-5 shrink-0 accent-[var(--ink)]" />
            <span className="text-sm">
              I agree to the <Link href="/terms" target="_blank" className="underline">Terms of use</Link> and <Link href="/privacy" target="_blank" className="underline">Privacy policy</Link>.
            </span>
          </label>
          {err("acceptTerms")}
        </div>
      </div>
      {error && !error.field && <p role="alert" className="mt-3 text-sm text-danger">{error.text}</p>}
      <Button type="submit" className="mt-5 min-h-12 w-full text-base" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
    </form>
  );
}

export function AppealForm() {
  const id = useId();
  const [f, setF] = useState({ email: "", password: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-semibold">Appeal received</p>
        <p className="mt-1 text-sm text-ink-2">A moderator who wasn't involved in the original decision will review it. If the suspension is overturned you'll be able to sign in again.</p>
      </div>
    );
  }
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (f.body.trim().length < 10) return setError("Please explain in at least 10 characters.");
        setBusy(true);
        setError(null);
        try {
          await api("/api/appeals/suspension", { body: f });
          setDone(true);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>Email</label>
          <input id={`${id}-email`} type="email" autoComplete="email" required value={f.email} onChange={set("email")} aria-describedby={error ? `${id}-err` : undefined} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-pw`} className={labelClass}>Password</label>
          <input id={`${id}-pw`} type="password" autoComplete="current-password" required value={f.password} onChange={set("password")} aria-describedby={error ? `${id}-err` : undefined} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-body`} className={labelClass}>Why should the suspension be lifted?</label>
          <textarea id={`${id}-body`} required rows={5} minLength={10} maxLength={2000} value={f.body} onChange={set("body")} aria-describedby={`${id}-count${error ? ` ${id}-err` : ""}`} className="w-full rounded-xl border border-line bg-surface p-3 text-base" />
          <p id={`${id}-count`} className="text-xs text-ink-3">{f.body.length} / 2,000 · at least 10 characters</p>
        </div>
      </div>
      {error && <p id={`${id}-err`} role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <Button type="submit" className="mt-5 min-h-12 w-full text-base" disabled={busy}>{busy ? "Submitting…" : "Submit appeal"}</Button>
    </form>
  );
}

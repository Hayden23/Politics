import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { googleEnabled, safeNext } from "@/server/auth/oauth";
import { AuthShell } from "@/components/AuthShell";
import { GoogleButton, LoginForm } from "@/components/AuthForms";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

const OAUTH_ERRORS: Record<string, string> = {
  oauth_unavailable: "Google sign-in isn't available right now. Use your email and password instead.",
  oauth_state: "That sign-in attempt expired or was interrupted. Please try again.",
  oauth_failed: "We couldn't complete sign-in with Google. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getActor()) redirect(next);
  const q = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthShell title="Sign in" intro={<p>Welcome back. Your answers stay private.</p>}>
      {sp.error === "suspended" ? (
        <Notice tone="warn" className="mb-5">
          This account is suspended. <Link href="/appeal" className="font-semibold underline">Appeal the suspension</Link>.
        </Notice>
      ) : sp.error && OAUTH_ERRORS[sp.error] ? (
        <Notice tone="warn" className="mb-5">{OAUTH_ERRORS[sp.error]}</Notice>
      ) : null}
      {googleEnabled() && <GoogleButton next={next} />}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-2">
        New here? <Link href={`/signup${q}`} className="font-semibold underline">Create an account</Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-ink-2 underline">Continue reading without an account</Link>
      </p>
    </AuthShell>
  );
}

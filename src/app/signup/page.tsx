import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { googleEnabled, safeNext } from "@/server/auth/oauth";
import { AuthShell } from "@/components/AuthShell";
import { GoogleButton, SignupForm } from "@/components/AuthForms";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an account" };

const ERRORS: Record<string, string> = {
  oauth_unavailable: "Google sign-up isn't available right now. Use your email instead.",
  oauth_state: "That sign-up attempt expired or was interrupted. Please try again.",
  oauth_failed: "We couldn't complete sign-up with Google. Please try again.",
  suspended: "That account is suspended.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getActor()) redirect(next);
  const q = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthShell
      title="Create your account"
      intro={<p>Free. Your answers are private by default — we never show individual responses and never sell political data.</p>}
    >
      {sp.error && ERRORS[sp.error] && (
        <Notice tone="warn" className="mb-5">
          {ERRORS[sp.error]}
          {sp.error === "suspended" && <> <Link href="/appeal" className="font-semibold underline">Appeal the suspension</Link>.</>}
        </Notice>
      )}
      {googleEnabled() && <GoogleButton next={next} />}
      <SignupForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-2">
        Already have an account? <Link href={`/login${q}`} className="font-semibold underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

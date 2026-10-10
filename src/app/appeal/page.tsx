import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { AppealForm } from "@/components/AuthForms";

export const metadata = { title: "Appeal a suspension" };

export default function AppealPage() {
  return (
    <AuthShell
      title="Appeal a suspension"
      intro={
        <p>
          Suspended accounts can't sign in, so confirm your email and password here. A moderator who wasn't involved in the original decision will review your appeal against the <Link href="/guidelines" className="underline">community guidelines</Link>.
        </p>
      }
    >
      <AppealForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="inline-flex min-h-11 items-center text-ink-2 underline">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

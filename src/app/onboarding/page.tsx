import { requirePageActor } from "@/server/auth/session";
import { safeNext } from "@/server/auth/oauth";
import { listTopics } from "@/server/services/reader";
import { AuthShell } from "@/components/AuthShell";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get started" };

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const actor = await requirePageActor("/onboarding");
  const topics = await listTopics();
  return (
    <AuthShell wide title={`Welcome${actor.displayName ? `, ${actor.displayName}` : ""}`} intro={<p>Two optional steps. Everything here can be skipped and changed later in your Profile.</p>}>
      <OnboardingForm topics={topics} next={next} />
    </AuthShell>
  );
}

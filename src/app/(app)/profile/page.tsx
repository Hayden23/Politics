import Link from "next/link";
import type { ReactNode } from "react";
import { getActor } from "@/server/auth/session";
import { canPost, isStaff } from "@/server/auth/roles";
import { getSettings } from "@/server/services/identity";
import { listBlocked } from "@/server/services/community";
import { listTopics } from "@/server/services/reader";
import { myEnforcement } from "@/server/services/moderation";
import { Card, LinkButton, Notice, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { BlockedList, DeleteAccount, DemographicsForm, DisplayNameForm, NotificationsForm, PrivacyToggle, SignOutButton, StandingList, TopicsForm } from "./ProfileForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

function Section({ id, title, children, tone }: { id: string; title: string; children: ReactNode; tone?: "danger" }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20">
      <Card className={tone === "danger" ? "border-danger/40" : ""}>
        <h2 id={`${id}-h`} className={`mb-3 text-lg font-semibold ${tone === "danger" ? "text-danger" : ""}`}>{title}</h2>
        {children}
      </Card>
    </section>
  );
}

export default async function Profile() {
  const actor = await getActor();

  if (!actor) {
    return (
      <div>
        <PageHeader title="Profile" />
        <Card>
          <p className="font-semibold">Sign in to manage your account</p>
          <p className="mt-1 text-sm text-ink-2">An account lets you answer questions, keep a private history of your views, save briefings and join discussions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/signup?next=/profile">Create an account</LinkButton>
            <LinkButton href="/login?next=/profile" variant="secondary">Sign in</LinkButton>
          </div>
        </Card>
        <ul className="mt-6 space-y-1 text-sm">
          <li><Link href="/guidelines" className="inline-flex min-h-11 items-center underline">Community guidelines</Link></li>
          <li><Link href="/privacy" className="inline-flex min-h-11 items-center underline">Privacy policy</Link></li>
          <li><Link href="/methodology" className="inline-flex min-h-11 items-center underline">How results work</Link></li>
        </ul>
      </div>
    );
  }

  const [settings, topics, blocked, enforcement] = await Promise.all([getSettings(actor.id), listTopics(), listBlocked(actor), myEnforcement(actor)]);
  const restricted = !canPost(actor);

  return (
    <div>
      <PageHeader title="Profile" kicker={settings.email ?? undefined}>
        <p>Manage how you appear, what we store, and your account.</p>
      </PageHeader>

      {isStaff(actor) && (
        <Notice className="mb-6">
          You have staff access. <Link href="/admin" className="font-semibold underline">Open the newsroom</Link>
        </Notice>
      )}
      {restricted && (
        <Notice tone="warn" className="mb-6">
          Your account can't post comments right now{actor.restrictedUntil ? ` (until ${formatDate(actor.restrictedUntil)})` : ""}. You can still read and rate. See <a href="#standing" className="underline">Account standing</a>.
        </Notice>
      )}

      <div className="space-y-5">
        <Section id="account" title="Account">
          <DisplayNameForm initial={settings.displayName} />
        </Section>

        <Section id="topics" title="Topics">
          <TopicsForm topics={topics} initial={settings.topics} />
        </Section>

        <Section id="notifications" title="Email">
          <NotificationsForm initial={settings.notificationFrequency} />
        </Section>

        <Section id="privacy" title="Privacy">
          <p className="mb-4 text-sm text-ink-2">Your ratings are private by default. We never show individual responses in results, and we never sell political data.</p>
          <PrivacyToggle initial={settings.showRatingOnComments} />
        </Section>

        <Section id="demographics" title="Optional demographics">
          <DemographicsForm initial={settings.demographics} />
        </Section>

        <Section id="data" title="Your data">
          <p className="text-sm text-ink-2">Download everything we hold about you — account, preferences, ratings and their history, comments and more — as a JSON file.</p>
          <a href="/api/me/export" download className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
            Download my data
          </a>
          <p className="mt-3 text-sm"><Link href="/privacy" className="underline">Privacy policy</Link></p>
        </Section>

        <Section id="blocked" title="Blocked users">
          <p className="mb-2 text-sm text-ink-2">You don't see comments from people you've blocked.</p>
          <BlockedList users={blocked.map((b) => ({ id: b.id, name: b.name, since: b.since.toISOString() }))} />
        </Section>

        <Section id="standing" title="Account standing">
          <StandingList items={enforcement} />
          <p className="mt-3 text-sm text-ink-2">Moderation follows our <Link href="/guidelines" className="underline">community guidelines</Link>. Each decision can be appealed once and is reviewed by a different moderator.</p>
        </Section>

        <Section id="session" title="Sign out">
          <SignOutButton />
        </Section>

        <Section id="delete" title="Delete account" tone="danger">
          <DeleteAccount />
        </Section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DraftNotice, Prose } from "@/components/Prose";
import { ANALYTICS_RETENTION_DAYS } from "@/server/services/analytics";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <article>
      <PageHeader title="Privacy" kicker="In plain language">
        <p>Your political views are sensitive. Here's exactly what {APP_NAME} collects, why, and the control you have.</p>
      </PageHeader>
      <DraftNotice />
      <Prose>
        <h2>The short version</h2>
        <ul>
          <li>Your answers are <strong>private by default</strong>. Results only ever show totals, never an individual's answer.</li>
          <li>Demographic details are <strong>optional</strong>, need your explicit consent, and are stored separately.</li>
          <li>We <strong>never sell</strong> your data, and we never sell or share political data for advertising or campaigning.</li>
          <li>Our usage analytics <strong>never include your answers</strong>.</li>
          <li>You can <strong>download</strong> everything we hold, or <strong>delete</strong> your account, at any time.</li>
        </ul>

        <h2>What we collect</h2>
        <h3>Account</h3>
        <p>Your email address, display name, and either a securely hashed password or an identifier from Google if you sign in with Google. We record when you accepted the terms and privacy policy.</p>
        <h3>Your answers</h3>
        <p>Each answer you give, plus a private history of changes so you can see how your views evolved in <Link href="/me">My views</Link>. Only you can see your individual answers and history.</p>
        <h3>What you write and do</h3>
        <p>Comments and replies, “insightful” reactions, saved briefings, reports you file, people you block or comments you hide, and any moderation decisions or appeals involving your account.</p>
        <h3>Preferences</h3>
        <p>Topics you follow, how often we may email you, and whether to show your answer next to your comments.</p>
        <h3>Optional demographics</h3>
        <p>Only if you tick the consent box: state, age range, area type (urban, suburban, rural) and political self-identification. Each can be left as “Prefer not to say”. These are kept in a separate table from your account, are never shown on your profile or comments, and are never used to give you a political label. They exist only to produce aggregate breakdowns once enough people have answered. Unchecking consent and saving deletes them.</p>
        <h3>Usage analytics</h3>
        <p>We record a small set of events (for example “viewed a briefing” or “saw results”) to understand whether the app is working. Events use a one-way pseudonymous ID rather than your account ID and <strong>never include which answer you gave</strong>. They are automatically deleted after {ANALYTICS_RETENTION_DAYS} days.</p>
        <h3>Cookies</h3>
        <p>A sign-in cookie that keeps you logged in (it expires after 30 days), a short-lived cookie used during Google sign-in, and a cookie remembering that you've seen the welcome screen. We don't use advertising or cross-site tracking cookies.</p>

        <h2>Who can see what</h2>
        <ul>
          <li><strong>Other participants</strong> see your display name and comments. They see your answer to a question only if you turn on “Show my answer next to my comments”, and only beside your comments in that discussion.</li>
          <li><strong>Results</strong> are totals across everyone who answered. No one can look up how a particular person answered.</li>
          <li><strong>Moderators</strong> see reported content and the account history needed to apply the community guidelines.</li>
          <li><strong>Editors</strong> see aggregate results and reports about briefings, not individual answers.</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>We keep account data, answers and comments for as long as you have an account. Analytics events are deleted after {ANALYTICS_RETENTION_DAYS} days. Sign-in sessions expire after 30 days. Short-lived anti-abuse records (like rate limits) are purged automatically.</p>

        <h2>Download your data</h2>
        <p>From <Link href="/profile#data">Profile → Your data</Link> you can download a JSON file containing your account details, preferences, demographics (if any), consent records, answers and their history, comments, reactions, saved briefings, reports you filed, blocks, moderation actions and appeals.</p>

        <h2>Delete your account</h2>
        <p>From <Link href="/profile#delete">Profile → Delete account</Link>. Deletion happens immediately and can't be undone.</p>
        <ul>
          <li><strong>Deleted outright:</strong> your answers and their history, demographic details, preferences, password, sign-in sessions, saved briefings, reactions, blocks (both ones you made and ones others made of you), hidden comments, and appeals.</li>
          <li><strong>De-identified:</strong> your comments are erased and shown as “[deleted]” so replies still make sense; reports you filed are kept for safety but no longer linked to you; your email and display name are removed and the account is left as an anonymous placeholder so editorial records stay consistent.</li>
          <li><strong>Kept as a record:</strong> the consent records showing what you agreed to and when, attached to the anonymous placeholder.</li>
        </ul>
        <p>Because results are totals, deleting your account removes your answers from future results.</p>

        <h2>Changes</h2>
        <p>If we change how we handle your data in a meaningful way, we'll tell you in the app before it takes effect and ask again where consent is required.</p>
      </Prose>
    </article>
  );
}

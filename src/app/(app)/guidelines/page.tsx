import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/Prose";
import { EDIT_WINDOW_HOURS } from "@/server/services/community";

export const metadata = { title: "Community guidelines" };

export default function Guidelines() {
  return (
    <article>
      <PageHeader title="Community guidelines" kicker="How we talk to each other">
        <p>Discussions here exist so people can understand why others see an issue differently. Disagree as much as you like — just do it with respect.</p>
      </PageHeader>
      <Prose>
        <h2>What we ask</h2>
        <ul>
          <li><strong>Be civil.</strong> Write as if the person you disagree with is reading — because they are.</li>
          <li><strong>Argue ideas, not people.</strong> Explain your reasoning; don't guess at others' motives or character.</li>
          <li><strong>Stay on the question.</strong> Explanations should be about the briefing's question and why you answered as you did.</li>
          <li><strong>Assume good faith.</strong> Ask a question before assuming the worst.</li>
        </ul>

        <h2>What's clearly allowed</h2>
        <p>Disagreement is the point. You may strongly criticize governments, officials, parties, candidates, policies, institutions and ideas — including the ones other participants support. Moderators don't remove comments because they're unpopular, one-sided or because a moderator disagrees with them. Reporting a comment simply because you disagree with it won't get it removed.</p>

        <h2>What isn't allowed</h2>
        <ul>
          <li><strong>Harassment or personal attacks</strong> — insults, name-calling, or targeting another participant.</li>
          <li><strong>Hate</strong> — attacking people based on race, ethnicity, national origin, religion, sex, gender identity, sexual orientation, disability or similar characteristics.</li>
          <li><strong>Threats and incitement</strong> — threatening or encouraging violence against anyone, including public figures.</li>
          <li><strong>Doxxing</strong> — sharing someone's private or identifying information (home address, phone number, private accounts, workplace details) without consent.</li>
          <li><strong>Spam</strong> — advertising, repeated posts, link-dumping, or posts written to game rankings.</li>
          <li><strong>Impersonation</strong> — pretending to be another person, organization, or a member of our staff.</li>
        </ul>

        <h2>Your comments</h2>
        <p>You can edit a comment for {EDIT_WINDOW_HOURS} hours after posting; edited comments are marked “edited”. You can delete your own comment at any time. If others replied, their replies stay and your comment is shown as “[deleted]”.</p>
        <p>Whether your answer appears next to your comments is your choice, set in <Link href="/profile#privacy">Profile → Privacy</Link>. It's off by default.</p>

        <h2>Tools you control</h2>
        <ul>
          <li><strong>Hide</strong> removes a single comment from your view.</li>
          <li><strong>Block</strong> hides everything a person writes from you. They aren't notified. Manage blocks in your Profile.</li>
          <li><strong>Report</strong> sends a comment to a moderator when you think it breaks these rules.</li>
        </ul>

        <h2>How moderation works</h2>
        <ol>
          <li><strong>Reports</strong> are reviewed by a human moderator against these guidelines. The reporter's identity isn't shared with the author.</li>
          <li><strong>Removal.</strong> A comment that breaks the rules is removed and shown as “[removed by a moderator]”.</li>
          <li><strong>Warnings</strong> are recorded on your account and shown to you under Profile → Account standing.</li>
          <li><strong>Restrictions</strong> stop you from posting or replying for a set period (typically 7 days). You can still read, rate and see results.</li>
          <li><strong>Suspensions</strong> are for serious or repeated violations. A suspended account can't sign in.</li>
        </ol>

        <h2>Appeals</h2>
        <p>Every removal, warning, restriction and suspension can be appealed once. Appeals are reviewed by a different moderator from the one who made the decision. If an appeal is overturned, removed content is restored and restrictions are lifted.</p>
        <p>Appeal from <Link href="/profile#standing">Profile → Account standing</Link>. If your account is suspended and you can't sign in, use the <Link href="/appeal">suspension appeal form</Link>.</p>
      </Prose>
    </article>
  );
}

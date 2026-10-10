import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DraftNotice, Prose } from "@/components/Prose";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <article>
      <PageHeader title="Terms of use" kicker="The agreement" />
      <DraftNotice />
      <Prose>
        <h2>What {APP_NAME} is</h2>
        <p>{APP_NAME} publishes short, neutral briefings on public issues, asks one question about each, and then shows how participating users answered, their explanations, and the original reporting. Briefings are drafted with help from software and reviewed by human editors before publication.</p>

        <h2>Your account</h2>
        <ul>
          <li>You must be at least 18 years old to create an account.</li>
          <li>Keep your sign-in details secure. You're responsible for activity on your account.</li>
          <li>One person, one account. Don't create accounts to influence results or evade moderation.</li>
        </ul>

        <h2>Using the service fairly</h2>
        <ul>
          <li>Answer honestly and for yourself. Don't automate answers or coordinate to skew results.</li>
          <li>Follow the <Link href="/guidelines">community guidelines</Link> when you write comments.</li>
          <li>Don't scrape, overload, or try to access data you're not permitted to see.</li>
        </ul>

        <h2>Your content</h2>
        <p>You own what you write. By posting, you let us display it within the app alongside the relevant discussion, and keep it as described in our <Link href="/privacy">privacy policy</Link>. You can delete your comments at any time.</p>

        <h2>Moderation</h2>
        <p>We may remove content, issue warnings, restrict posting or suspend accounts that break these terms or the community guidelines. Decisions can be appealed as described in the guidelines.</p>

        <h2>Results and information</h2>
        <p>Results reflect the participating registered users who chose to answer. They are unweighted and are not a scientific poll or a representative sample of any population. Briefings aim to be accurate and neutral, but may contain errors; we correct them openly and link to original sources. See <Link href="/methodology">how results work</Link>.</p>

        <h2>Third-party links</h2>
        <p>Source links take you to publishers' own sites, which have their own terms and privacy practices.</p>

        <h2>Ending your account</h2>
        <p>You can delete your account at any time from your Profile. We may close accounts that seriously or repeatedly violate these terms.</p>

        <h2>Changes</h2>
        <p>We'll notify you in the app before material changes to these terms take effect.</p>
      </Prose>
    </article>
  );
}

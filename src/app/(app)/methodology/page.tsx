import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/Prose";
import { SMALL_SAMPLE_THRESHOLD } from "@/domain/aggregation";
import { thresholds } from "@/server/services/breakdowns";
import { POPULATION_DESCRIPTION, POPULATION_LABEL } from "@/server/services/reader";
import { UNCERTAIN_LABEL } from "@/domain/scale";

export const dynamic = "force-dynamic";
export const metadata = { title: "How results work" };

export default function Methodology() {
  const t = thresholds();
  return (
    <article>
      <PageHeader title="How results work" kicker="Methodology">
        <p>What the numbers mean — and what they don't.</p>
      </PageHeader>
      <Prose>
        <h2>Read first, then see results</h2>
        <p>Every briefing is shown without publisher names or anyone else's opinion. Results, discussion and original sources unlock only after you answer, so your view is your own.</p>

        <h2>Who is counted</h2>
        <p>Results are labeled “{POPULATION_LABEL}”. {POPULATION_DESCRIPTION}</p>
        <p>That means results describe the people using this app — who may differ from the general public in age, location, political interest and many other ways. They are <strong>not weighted</strong> to match any population, and they are <strong>not a scientific poll</strong>. Please don't report them as public opinion.</p>

        <h2>The scale</h2>
        <p>Most questions use a seven-point scale from “Strongly oppose” to “Strongly support”, with “Neutral” in the middle. Grouped views combine the three oppose options, Neutral, and the three support options.</p>

        <h2>“{UNCERTAIN_LABEL}”</h2>
        <p>Saying you don't know enough is a legitimate answer, so it's counted — but <strong>separately</strong>. It is not folded into Neutral, and percentages are calculated from valid scale responses only. The number of uncertain responses is always shown alongside.</p>

        <h2>Small samples</h2>
        <p>When a question has fewer than {SMALL_SAMPLE_THRESHOLD} valid responses, results carry a small-sample warning. With so few answers, one or two people can swing the percentages a lot.</p>

        <h2>Rounding</h2>
        <p>Counts are exact. Percentages are rounded to whole numbers for display, so they may not add up to exactly 100%.</p>

        <h2>Changing your answer</h2>
        <p>You can update your answer at any time. Results always count each person's current answer once. Your earlier answers stay in your private history.</p>

        <h2>Question versions</h2>
        <p>If editors revise a question's wording, the new wording starts as a new version with its own results. Answers to earlier wording are kept and shown separately, so their meaning doesn't change after the fact.</p>

        <h2 id="breakdowns" className="scroll-mt-20">Breakdowns by ideology, state and demographics</h2>
        <p>After you answer, the Breakdowns tab shows how responses differ by political self-identification, by state, by age range and by area type (urban, suburban, rural).</p>
        <ul>
          <li><strong>Opt-in only.</strong> Only people who chose to share these details, and consented to their use in aggregate breakdowns, are counted. Everyone else is still counted in the main results.</li>
          <li><strong>Self-identification.</strong> “Self-identified liberals” combines people who chose “very liberal” or “liberal”; “moderates” those who chose “moderate”; “conservatives” those who chose “conservative” or “very conservative”. Other answers are left out. We never infer or assign anyone's ideology.</li>
          <li><strong>Minimum group sizes.</strong> A group is shown only once it has at least {t.ideology} valid responses for political self-identification, {t.state} for a single state, and {t.demographic} for an age range or area type. Smaller groups are hidden entirely — not even their counts are shown — to protect privacy and avoid misleading tiny samples.</li>
          <li><strong>Unweighted.</strong> Like all results here, breakdowns describe participating users and are not representative of any state or group.</li>
          <li><strong>Changed minds.</strong> This compares each person's first answer with their current one, across everyone who answered.</li>
        </ul>

        <h2 id="lean" className="scroll-mt-20">Left/right perspectives and outlet lean ratings</h2>
        <p>The “Left vs Right” tab summarizes how each side of the broad US political spectrum tends to see a story: its strongest arguments, how it frames the issue and the values it emphasizes. Editors write these from the cited coverage and aim to describe each side the way its own supporters would. They are not this app's view, and both sides get the same space and treatment.</p>
        <p>Each publisher can carry a lean rating — left, lean left, center, lean right, right, or not rated — assigned by editors with a stated basis that you can see next to the source. Ratings describe an outlet in general, not any single article, and are a rough guide rather than a verdict.</p>
        <p>Perspectives, lean ratings and the coverage balance are shown <strong>only after you rate</strong>, like results and sources, so they can't color your first reaction to the briefing. If a summary seems unfair to either side, use “Report a framing concern” on the Left vs Right tab.</p>

        <h2>Over time</h2>
        <p>Where there's enough data, results pages show how cumulative shares changed by the date people first answered.</p>

        <p className="mt-8 text-sm text-ink-2">Questions about the method? See our <Link href="/privacy">privacy policy</Link> for what we collect, or the <Link href="/guidelines">community guidelines</Link> for discussions.</p>
      </Prose>
    </article>
  );
}

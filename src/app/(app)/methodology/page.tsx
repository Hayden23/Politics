import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/Prose";
import { SMALL_SAMPLE_THRESHOLD, STATE_THRESHOLD } from "@/domain/aggregation";
import { POPULATION_DESCRIPTION, POPULATION_LABEL } from "@/server/services/reader";
import { UNCERTAIN_LABEL } from "@/domain/scale";

export const metadata = { title: "How results work" };

export default function Methodology() {
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

        <h2>Breakdowns by group</h2>
        <p>Results by state or other groups are not shown yet. When they are added, they'll use only demographic details people chose to share, and a state's results will appear only once at least {STATE_THRESHOLD} people from that state have answered, to protect privacy and avoid misleading tiny samples.</p>

        <h2>Over time</h2>
        <p>Where there's enough data, results pages show how cumulative shares changed by the date people first answered.</p>

        <p className="mt-8 text-sm text-ink-2">Questions about the method? See our <Link href="/privacy">privacy policy</Link> for what we collect, or the <Link href="/guidelines">community guidelines</Link> for discussions.</p>
      </Prose>
    </article>
  );
}

import { requireEditor } from "../../_lib/guard";
import { listTopics } from "@/server/services/reader";
import { Card, PageHeader } from "@/components/ui";
import { NewStoryForm } from "@/components/admin/NewStoryForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New story" };

export default async function NewStoryPage() {
  await requireEditor("/admin/stories/new");
  const topics = await listTopics();
  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Editorial" title="New story">
        Creates a draft. You'll add sources, the rating question and the full briefing in the editor.
      </PageHeader>
      <Card>
        <NewStoryForm topics={topics.map((t) => ({ id: t.id, name: t.name }))} />
      </Card>
    </div>
  );
}

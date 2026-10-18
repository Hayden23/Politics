import { requirePageActor } from "@/server/auth/session";
import { listNotifications } from "@/server/services/notifications";
import { Empty, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { MarkAllRead, NotificationLink } from "./NotificationActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

function when(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return formatDate(d);
}

export default async function NotificationsPage() {
  const actor = await requirePageActor("/notifications");
  const items = await listNotifications(actor);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div>
      <PageHeader title="Notifications">
        <p>New briefings in topics you follow, and replies to your explanations.</p>
      </PageHeader>

      <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm text-ink-2" aria-live="polite">{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
        {unread > 0 && <MarkAllRead />}
      </div>

      {items.length === 0 ? (
        <Empty title="No notifications yet">Follow topics on Discover or in your Profile to hear about new briefings.</Empty>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const isUnread = !n.readAt;
            const inner = (
              <>
                <div className="flex items-start gap-3">
                  <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${isUnread ? "bg-accent" : "bg-transparent"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`leading-snug ${isUnread ? "font-semibold" : "font-medium text-ink-2"}`}>
                      {isUnread && <span className="sr-only">Unread: </span>}
                      {n.title}
                    </p>
                    {n.body && <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>}
                    <p className="mt-1 text-xs text-ink-3"><time dateTime={n.createdAt.toISOString()}>{when(n.createdAt)}</time></p>
                  </div>
                </div>
              </>
            );
            const cls = `block rounded-2xl border p-4 transition ${isUnread ? "border-line bg-surface" : "border-transparent bg-surface-2/50"}`;
            return (
              <li key={n.id}>
                {n.link && n.link.startsWith("/") ? (
                  <NotificationLink id={n.id} href={n.link} unread={isUnread} className={`${cls} hover:border-ink-3`}>
                    {inner}
                  </NotificationLink>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { BottomNav, MainWidth, TopNav } from "@/components/Nav";
import { unreadCount } from "@/server/services/notifications";
import { getActor } from "@/server/auth/session";
import { isStaff } from "@/server/auth/roles";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const unread = actor ? await unreadCount(actor.id) : 0;
  return (
    <>
      <TopNav appName={APP_NAME} signedIn={!!actor} staff={isStaff(actor)} unread={unread} />
      <MainWidth>{children}</MainWidth>
      <footer className="mx-auto hidden max-w-3xl px-4 pb-10 text-xs text-ink-3 md:block">
        <Link href="/guidelines" className="hover:underline">Community guidelines</Link> · <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/methodology" className="hover:underline">How results work</Link>
      </footer>
      <BottomNav />
    </>
  );
}

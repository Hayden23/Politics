import { BottomNav, TopNav } from "@/components/Nav";
import { getActor } from "@/server/auth/session";
import { isStaff } from "@/server/auth/roles";
import { APP_NAME } from "@/lib/brand";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  return (
    <>
      <TopNav appName={APP_NAME} signedIn={!!actor} staff={isStaff(actor)} />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:pb-16">
        {children}
      </main>
      <footer className="mx-auto hidden max-w-3xl px-4 pb-10 text-xs text-ink-3 md:block">
        <Link href="/guidelines" className="hover:underline">Community guidelines</Link> · <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/methodology" className="hover:underline">How results work</Link>
      </footer>
      <BottomNav />
    </>
  );
}

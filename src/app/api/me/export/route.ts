import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { exportUserData } from "@/server/services/identity";

export const GET = route(async () => {
  const actor = await requireApiActor();
  const data = await exportUserData(actor.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});

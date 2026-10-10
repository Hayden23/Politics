/** Usage: npm run set-role -- someone@example.com editor */
import { sql } from "drizzle-orm";
import { db, closeDb } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { audit } from "../src/server/services/audit";

const [email, role] = process.argv.slice(2);
if (!email || !["user", "moderator", "editor", "admin"].includes(role)) {
  console.error("Usage: npm run set-role -- <email> <user|moderator|editor|admin>");
  process.exit(1);
}
const rows = await db.update(users).set({ role: role as "user" }).where(sql`lower(${users.email}) = ${email.toLowerCase()}`).returning();
if (!rows.length) console.error(`No user with email ${email}`);
else {
  await audit(db, null, "user.role_change_cli", "user", rows[0].id, null, { role });
  console.log(`${email} is now ${role}`);
}
await closeDb();

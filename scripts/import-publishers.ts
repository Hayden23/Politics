/**
 * Imports outlet lean ratings from a CSV you are licensed to use:
 *   name,domain,lean,basis
 *   Example News,example.com,center,"<rating service> 2026 rating"
 * lean ∈ left | lean_left | center | lean_right | right | unrated. Rows without a basis are imported as unrated.
 * Usage: npm run publishers:import -- path/to/file.csv
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../src/server/db";
import { publishers } from "../src/server/db/schema";
import { audit } from "../src/server/services/audit";

const LEANS = new Set(["left", "lean_left", "center", "lean_right", "right", "unrated"]);
const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run publishers:import -- <file.csv>");
  process.exit(1);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}

const [header, ...rows] = parseCsv(readFileSync(file, "utf8"));
const col = (n: string) => header.map((h) => h.trim().toLowerCase()).indexOf(n);
let n = 0;
for (const r of rows) {
  const name = r[col("name")]?.trim();
  if (!name) continue;
  const domain = r[col("domain")]?.trim().toLowerCase().replace(/^www\./, "") || null;
  const basis = r[col("basis")]?.trim() || null;
  let lean = r[col("lean")]?.trim().toLowerCase() || "unrated";
  if (!LEANS.has(lean) || !basis) lean = "unrated";
  const [p] = await db
    .insert(publishers)
    .values({ name, domain, lean: lean as "center", leanBasis: basis })
    .onConflictDoUpdate({ target: publishers.name, set: { domain: sql`coalesce(excluded.domain, publishers.domain)`, lean: sql`excluded.lean`, leanBasis: sql`excluded.lean_basis`, updatedAt: new Date() } })
    .returning();
  await audit(db, null, "publisher.import", "publisher", p.id, null, { lean: p.lean, basis: p.leanBasis });
  n++;
}
console.log(`Imported ${n} publishers`);
await closeDb();

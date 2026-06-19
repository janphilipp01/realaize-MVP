import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: node _apply.mjs <sql-file>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

// Strip any sslmode from the URL — it now means verify-full in pg, which
// fails against Supabase's self-signed pooler chain. We pass our own ssl opts.
const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/g, "$1").replace(/[?&]$/, "");
const client = new pg.Client({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const sql = readFileSync(file, "utf8");
try {
  await client.query(sql);
  console.log(`applied: ${file}`);
} finally {
  await client.end();
}

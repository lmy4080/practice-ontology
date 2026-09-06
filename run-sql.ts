import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const sqlFile = process.argv[2] === "--" ? process.argv[3] : process.argv[2];

if (!sqlFile || !sqlFile.endsWith(".sql")) {
  console.error("Usage: pnpm run run-sql -- path/to/file.sql");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  const sql = await fs.readFile(path.resolve(process.cwd(), sqlFile), "utf8");
  await client.connect();
  const result = await client.query(sql);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

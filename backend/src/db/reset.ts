import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

async function seed(): Promise<void> {
  console.log("Resetting the public database schema...");
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log(`Database reset complete.`);
}

seed()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

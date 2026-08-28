import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";
import { merchants, users } from "./schema.js";
import bcrypt from "bcrypt";
import { generateDemoData } from "../modules/payments/demo-data.js";

const demoPassword = "demo-password-123";
const DEMO_EMAIL = "demo@paylab.test";
const DEMO_SLUG = "demo-store";
const DEMO_USER_ID = "10000000-0000-0000-0000-000000000001";

async function seed(): Promise<void> {
  console.log("Resetting the public database schema...");
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await migrate(db, { migrationsFolder: "./drizzle" });

  // const result = await db.transaction(async (tx) => {
  //   const [user] = await tx.insert(users).values({
  //     id: DEMO_USER_ID,
  //     email: DEMO_EMAIL,
  //     passwordHash: await bcrypt.hash(demoPassword, 12),
  //     role: "merchant_admin"
  //   }).returning();
  //   if (!user) throw new Error("Unable to create demo user");

  //   const [merchant] = await tx.insert(merchants).values({
  //     ownerUserId: user.id,
  //     name: "PAYLAB Demo Store",
  //     slug: DEMO_SLUG,
  //     defaultCurrency: "INR",
  //     timezone: "Asia/Kolkata",
  //     dataSource: "demo"
  //   }).returning();
  //   if (!merchant) throw new Error("Unable to create demo merchant");

  //   return generateDemoData(tx, merchant.id, 20260828);
  // });

  console.log(`Database seeded successfully.`);
}

seed()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

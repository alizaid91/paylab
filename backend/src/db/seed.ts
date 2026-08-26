import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";
import {
  customers,
  merchants,
  paymentAttempts,
  payments,
  users,
} from "./schema.js";
import bcrypt from "bcrypt";

const demoPassword = "demo-password-123";
const DEMO_EMAIL = "demo@paylab.test";
const DEMO_SLUG = "demo-store";
const DEMO_USER_ID = "10000000-0000-0000-0000-000000000001";

const names = [
  "Aarav Mehta",
  "Isha Kapoor",
  "Rohan Shah",
  "Ananya Iyer",
  "Vikram Rao",
  "Neha Patel",
  "Kabir Singh",
  "Meera Nair",
  "Arjun Das",
  "Tara Joshi",
  "Dev Malhotra",
  "Priya Menon",
];

async function seed(): Promise<void> {
  console.log("Resetting the public database schema...");
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await migrate(db, { migrationsFolder: "./drizzle" });

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(demoPassword, 12),
      role: "merchant_admin",
    });

    const [merchant] = await tx
      .insert(merchants)
      .values({
        ownerUserId: DEMO_USER_ID,
        name: "PAYLAB Demo Store",
        slug: DEMO_SLUG,
        defaultCurrency: "INR",
        timezone: "Asia/Kolkata",
      })
      .returning();
    if (!merchant) throw new Error("Unable to create demo merchant");

    const customerRows = names.map((name, index) => ({
      merchantId: merchant.id,
      externalId: `demo-customer-${index + 1}`,
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      metadata: { segment: index % 3 === 0 ? "high_value" : "returning" },
    }));
    const seededCustomers = await tx
      .insert(customers)
      .values(customerRows)
      .returning();

    const paymentRows: Array<typeof payments.$inferInsert> = [];
    const attemptRows: Array<typeof paymentAttempts.$inferInsert> = [];
    const now = new Date();

    for (let index = 0; index < 240; index += 1) {
      const customer = seededCustomers[index % seededCustomers.length];
      const dayOffset = index % 60;
      const hourPattern = [9, 11, 14, 16, 20, 21, 22, 8, 19, 13];
      const hour = hourPattern[index % hourPattern.length];
      const createdAt = new Date(now);
      createdAt.setUTCDate(createdAt.getUTCDate() - dayOffset);
      createdAt.setUTCHours(hour, (index * 7) % 60, 0, 0);

      const paymentMethod =
        index % 5 < 2 ? "upi" : index % 5 < 4 ? "card" : "net_banking";
      const isMobile = paymentMethod === "card" && index % 3 !== 0;
      const eveningUpiFailure =
        paymentMethod === "upi" && hour >= 19 && hour <= 22 && index % 4 !== 0;
      const mobileCardFailure = isMobile && index % 5 === 0;
      const repeatFailure =
        (index % 12 === 0 || index % 17 === 0) &&
        customer.externalId.endsWith("1");
      const failed = eveningUpiFailure || mobileCardFailure || repeatFailure;
      const amount = (499 + ((index * 137) % 19501) / 100).toFixed(2);
      const paymentId = randomUUID();

      paymentRows.push({
        id: paymentId,
        merchantId: merchant.id,
        customerId: customer.id,
        externalId: `demo-payment-${index + 1}`,
        amount,
        currency: "INR",
        status: failed ? "failed" : "succeeded",
        paymentMethod,
        provider: "razorpay",
        paidAt: failed ? null : createdAt,
        createdAt,
        updatedAt: createdAt,
        metadata: {
          device: isMobile ? "mobile" : "desktop",
          channel: paymentMethod === "upi" ? "intent" : "checkout",
          seedPattern: eveningUpiFailure
            ? "upi_evening_failure"
            : mobileCardFailure
              ? "mobile_card_failure"
              : repeatFailure
                ? "repeat_customer_failure"
                : "baseline",
        },
      });

      const attemptCount = failed
        ? repeatFailure
          ? 3
          : 1
        : index % 9 === 0
          ? 2
          : 1;
      for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
        const attemptTime = new Date(
          createdAt.getTime() + (attempt - 1) * 90_000,
        );
        attemptRows.push({
          merchantId: merchant.id,
          paymentId,
          attemptNumber: attempt,
          status: failed || attempt < attemptCount ? "failed" : "succeeded",
          providerPaymentId: `demo-provider-${index + 1}-${attempt}`,
          errorCode:
            failed || attempt < attemptCount
              ? eveningUpiFailure
                ? "U16"
                : mobileCardFailure
                  ? "05"
                  : "DO_NOT_HONOR"
              : null,
          errorMessage:
            failed || attempt < attemptCount
              ? "Payment was declined by the payment provider"
              : null,
          processedAt: attemptTime,
          createdAt: attemptTime,
          updatedAt: attemptTime,
        });
      }
    }

    await tx.insert(payments).values(paymentRows);
    await tx.insert(paymentAttempts).values(attemptRows);
  });

  console.log(
    "Seeded PAYLAB demo merchant with 240 payments and payment attempts.",
  );
}

seed()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

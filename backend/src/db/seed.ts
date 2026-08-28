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
  "Aditya Verma",
  "Sana Khan",
  "Yash Thakur",
  "Nandini Bhat",
  "Kunal Bansal",
  "Riya Sethi",
  "Manav Gupta",
  "Aditi Kulkarni",
  "Siddharth Jain",
  "Pooja Reddy",
  "Rahul Sood",
  "Kavya Pillai",
  "Nikhil Arora",
  "Simran Kaur",
  "Varun Chawla",
  "Shruti Desai",
  "Harsh Vardhan",
  "Mahi Shah",
  "Ankit Tandon",
  "Ishita Bose",
  "Om Prakash",
  "Lavanya Roy",
  "Gaurav Khanna",
  "Divya Shetty",
  "Ritesh Nair",
  "Ayesha Mirza",
  "Mohit Saxena",
  "Tanvi Ghosh",
  "Abhishek Dutta",
  "Sonal Kapoor",
  "Rajiv Menon",
  "Nisha Thomas",
  "Pranav Rane",
  "Sneha Bedi",
  "Aman Oberoi",
  "Kritika Paul",
  "Suresh Iyer",
  "Reema Mathew",
  "Vivek Narang",
  "Pallavi Rao",
  "Sameer Kohli",
  "Juhi Agarwal",
  "Deepak Yadav",
  "Alisha Fernandes",
  "Raghav Bhatia",
  "Monika Wadhwa",
  "Naveen Joshi",
];

const PAYMENT_COUNT_PER_CUSTOMER = { min: 14, max: 30 };
const HISTORY_DAYS = 120;
const RECOVERY_RISK_SHARE = 0.16;
const EVENING_FAILURE_RATE = 0.58;
const MOBILE_CARD_FAILURE_RATE = 0.34;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

function weightedMethod(random: () => number): "upi" | "card" | "net_banking" {
  const value = random();
  return value < 0.48 ? "upi" : value < 0.86 ? "card" : "net_banking";
}

function transactionAmount(random: () => number, highValue: boolean): string {
  const ranges = highValue
    ? [[1200, 18000], [2500, 42000], [800, 9000]]
    : [[180, 2800], [350, 6500], [120, 1400]];
  const [minimum, maximum] = pick(random, ranges);
  return (minimum + random() * (maximum - minimum)).toFixed(2);
}

function isEvening(hour: number): boolean {
  return hour >= 19 && hour <= 22;
}

async function seed(): Promise<void> {
  console.log("Resetting the public database schema...");
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await migrate(db, { migrationsFolder: "./drizzle" });

  let seededCustomerCount = 0;
  let paymentCount = 0;
  let paymentAttemptCount = 0;
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

    const random = seededRandom(20260828);
    const customerRows = names.map((name, index) => ({
      merchantId: merchant.id,
      externalId: `demo-customer-${index + 1}`,
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      metadata: {
        segment: random() < 0.24 ? "high_value" : random() < 0.55 ? "returning" : "occasional",
        preferredChannel: pick(random, ["mobile", "desktop", "mixed"]),
        recoveryRisk: random() < RECOVERY_RISK_SHARE
      },
    }));
    const seededCustomers = await tx
      .insert(customers)
      .values(customerRows)
      .returning();
    seededCustomerCount = seededCustomers.length;

    const paymentRows: Array<typeof payments.$inferInsert> = [];
    const attemptRows: Array<typeof paymentAttempts.$inferInsert> = [];
    const now = new Date();

    let paymentNumber = 0;
    for (const customer of seededCustomers) {
      const customerMetadata = customer.metadata as { segment?: string; recoveryRisk?: boolean };
      const transactionCount = PAYMENT_COUNT_PER_CUSTOMER.min + Math.floor(
        random() * (PAYMENT_COUNT_PER_CUSTOMER.max - PAYMENT_COUNT_PER_CUSTOMER.min + 1)
      );
      for (let customerPayment = 0; customerPayment < transactionCount; customerPayment += 1) {
        paymentNumber += 1;
        const dayOffset = Math.floor(random() * HISTORY_DAYS);
        const hour = pick(random, [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
        const createdAt = new Date(now);
        createdAt.setUTCDate(createdAt.getUTCDate() - dayOffset);
        createdAt.setUTCHours(hour, Math.floor(random() * 60), Math.floor(random() * 60), 0);

        const paymentMethod = weightedMethod(random);
        const isMobile = paymentMethod === "card" && random() < 0.67;
        const eveningUpiFailure = paymentMethod === "upi" && isEvening(hour) && random() < EVENING_FAILURE_RATE;
        const mobileCardFailure = isMobile && random() < MOBILE_CARD_FAILURE_RATE;
        const repeatFailure = customerMetadata.recoveryRisk === true && random() < 0.48;
        const failed = eveningUpiFailure || mobileCardFailure || repeatFailure || random() < 0.025;
        const amount = transactionAmount(random, customerMetadata.segment === "high_value");
        const paymentId = randomUUID();

        paymentRows.push({
        id: paymentId,
        merchantId: merchant.id,
        customerId: customer.id,
        externalId: `demo-payment-${paymentNumber}`,
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
          failureReason: failed
            ? eveningUpiFailure
              ? "upi_timeout"
              : mobileCardFailure
                ? "issuer_decline"
                : repeatFailure
                  ? "customer_retryable_decline"
                  : "provider_decline"
            : null,
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
        ? repeatFailure || random() < 0.28 ? 2 + Math.floor(random() * 2) : 1
        : random() < 0.14 ? 2 : 1;
      for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
        const attemptTime = new Date(
          createdAt.getTime() + (attempt - 1) * 90_000,
        );
        attemptRows.push({
          merchantId: merchant.id,
          paymentId,
          attemptNumber: attempt,
          status: failed || attempt < attemptCount ? "failed" : "succeeded",
          providerPaymentId: `demo-provider-${paymentNumber}-${attempt}`,
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
    }

    await tx.insert(payments).values(paymentRows);
    await tx.insert(paymentAttempts).values(attemptRows);
    paymentCount = paymentRows.length;
    paymentAttemptCount = attemptRows.length;
  });

  console.log(
    `Seeded PAYLAB demo merchant with ${seededCustomerCount} customers, ${paymentCount} payments, and ${paymentAttemptCount} payment attempts.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

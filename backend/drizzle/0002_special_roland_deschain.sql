ALTER TABLE "payments" ALTER COLUMN "payment_method" SET DEFAULT 'card';--> statement-breakpoint
CREATE INDEX "payments_merchant_method_idx" ON "payments" USING btree ("merchant_id","payment_method");--> statement-breakpoint
CREATE INDEX "payments_merchant_created_at_idx" ON "payments" USING btree ("merchant_id","created_at");
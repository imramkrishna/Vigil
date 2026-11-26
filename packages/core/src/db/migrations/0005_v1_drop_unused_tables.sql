ALTER TABLE "action_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approvals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "model_usage" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ops_past_incidents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_budgets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "action_log" CASCADE;--> statement-breakpoint
DROP TABLE "approvals" CASCADE;--> statement-breakpoint
DROP TABLE "audit_events" CASCADE;--> statement-breakpoint
DROP TABLE "feedback" CASCADE;--> statement-breakpoint
DROP TABLE "model_usage" CASCADE;--> statement-breakpoint
DROP TABLE "ops_past_incidents" CASCADE;--> statement-breakpoint
DROP TABLE "tenant_budgets" CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_messages" ALTER COLUMN "mode" SET DEFAULT 'incident';--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "title" SET DEFAULT 'New evaluation';--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "mode" SET DEFAULT 'incident';
ALTER TABLE "ops_services" ADD COLUMN "repo_url" text;--> statement-breakpoint
ALTER TABLE "ops_services" ADD COLUMN "github_branch" text DEFAULT 'main';--> statement-breakpoint
ALTER TABLE "ops_services" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "ops_services" ADD COLUMN "log_url" text;--> statement-breakpoint
ALTER TABLE "ops_services" ADD COLUMN "platform_config" jsonb;
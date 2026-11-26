CREATE TABLE IF NOT EXISTS "org_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"auth_method" text NOT NULL,
	"public_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_secret" text,
	"key_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ops_service_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"trace_id" text,
	"metadata" jsonb,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_services" ADD COLUMN IF NOT EXISTS "integration_id" uuid;
--> statement-breakpoint
ALTER TABLE "org_integrations" ADD CONSTRAINT "org_integrations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "org_integrations" ADD CONSTRAINT "org_integrations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_services" ADD CONSTRAINT "ops_services_integration_id_org_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_service_logs" ADD CONSTRAINT "ops_service_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ops_service_logs" ADD CONSTRAINT "ops_service_logs_service_id_ops_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."ops_services"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_integrations_org_provider_idx" ON "org_integrations" USING btree ("org_id","provider");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_integrations_org_name_uq" ON "org_integrations" USING btree ("org_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ops_service_logs_org_svc_time_idx" ON "ops_service_logs" USING btree ("org_id","service_id","timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ops_service_logs_ingested_idx" ON "ops_service_logs" USING btree ("ingested_at");
--> statement-breakpoint
ALTER TABLE "org_integrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "org_integrations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "org_isolation" ON "org_integrations";
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "org_integrations"
  USING ("org_id"::text = current_setting('app.current_org_id', true))
  WITH CHECK ("org_id"::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
ALTER TABLE "ops_service_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ops_service_logs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "org_isolation" ON "ops_service_logs";
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "ops_service_logs"
  USING ("org_id"::text = current_setting('app.current_org_id', true))
  WITH CHECK ("org_id"::text = current_setting('app.current_org_id', true));

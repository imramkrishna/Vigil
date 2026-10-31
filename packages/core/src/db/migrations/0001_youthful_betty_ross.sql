CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"tsv" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "chunks" CASCADE;--> statement-breakpoint
ALTER TABLE "ops_services" DROP CONSTRAINT "ops_services_name_unique";--> statement-breakpoint
DROP INDEX "documents_org_idx";--> statement-breakpoint
DROP INDEX "ops_deploys_service_time_idx";--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "content_hash" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "content_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "mime_type" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "size" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "storage_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "chunk_count" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_deploys" ADD COLUMN "org_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_past_incidents" ADD COLUMN "org_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_services" ADD COLUMN "org_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_chunks_org_id_idx" ON "document_chunks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "document_chunks_tsv_idx" ON "document_chunks" USING gin ("tsv");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deploys" ADD CONSTRAINT "ops_deploys_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_past_incidents" ADD CONSTRAINT "ops_past_incidents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_services" ADD CONSTRAINT "ops_services_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_id_idx" ON "documents" USING btree ("id");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_org_id_idx" ON "documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ops_deploys_org_service_time_idx" ON "ops_deploys" USING btree ("org_id","service","deployed_at");--> statement-breakpoint
CREATE INDEX "ops_past_incidents_org_service_idx" ON "ops_past_incidents" USING btree ("org_id","service");--> statement-breakpoint
CREATE UNIQUE INDEX "ops_services_org_name_uq" ON "ops_services" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "ops_services_org_idx" ON "ops_services" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "source";--> statement-breakpoint

-- ============================================================================
-- Full-Text Search Trigger on document_chunks.tsv
-- (Re-attached because `DROP TABLE "chunks" CASCADE` dropped the old trigger)
-- ============================================================================
DROP TRIGGER IF EXISTS document_chunks_tsv_update ON "document_chunks";--> statement-breakpoint
CREATE TRIGGER document_chunks_tsv_update
  BEFORE INSERT OR UPDATE OF content ON "document_chunks"
  FOR EACH ROW EXECUTE FUNCTION chunks_tsv_update_trigger();--> statement-breakpoint

-- ============================================================================
-- Forced Row-Level Security on document_chunks & ops_* Tables
-- ============================================================================
ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_chunks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_chunks_tenant_isolation" ON "document_chunks"
  USING ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "ops_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ops_services" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ops_services_tenant_isolation" ON "ops_services"
  USING ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "ops_deploys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ops_deploys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ops_deploys_tenant_isolation" ON "ops_deploys"
  USING ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "ops_past_incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ops_past_incidents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ops_past_incidents_tenant_isolation" ON "ops_past_incidents"
  USING ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

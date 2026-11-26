import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { orgs } from "./tenancy";

/** Postgres full-text search column (not built into drizzle). */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const DOCUMENT_STATUSES = ["pending", "indexed", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** text-embedding-3-small */
export const EMBEDDING_DIMENSIONS = 1536;

export interface ChunkMetadata {
  documentId?: string;
  documentName?: string;
  title?: string;
  sourceUrl?: string;
  storageKey?: string;
  mimeType?: string;
  page?: number;
  chunkIndex?: number;
  totalChunks?: number;
  charStart?: number;
  charEnd?: number;
  lineStart?: number;
  lineEnd?: number;
}

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: varchar("content_hash", { length: 64 }),
    status: text("status", { enum: DOCUMENT_STATUSES })
      .default("pending")
      .notNull(),
    errorMessage: text("error_message"),
    chunkCount: integer("chunk_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("document_id_idx").on(table.id),
    index("documents_user_id_idx").on(table.userId),
    index("documents_org_id_idx").on(table.orgId),
    uniqueIndex("documents_org_content_hash_uq").on(
      table.orgId,
      table.contentHash
    ),
  ]
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    metadata: jsonb("metadata").$type<ChunkMetadata>().default({}),
    embedding: vector("embedding", {
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    tsv: tsvector("tsv"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_chunks_document_id_idx").on(table.documentId),
    index("document_chunks_org_id_idx").on(table.orgId),
    index("document_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
    index("document_chunks_tsv_idx").using("gin", table.tsv),
  ]
);

/** Alias for convenience across retrieval modules */
export const chunks = documentChunks;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type Chunk = DocumentChunk;
export type NewChunk = NewDocumentChunk;

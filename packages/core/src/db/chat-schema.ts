import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { incidents, orgs } from "./schema";

export const CHAT_MODES = ["incident"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

export const CHAT_ROLES = ["user", "assistant"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const CHAT_CONFIDENCES = ["high", "medium", "low"] as const;
export type ChatConfidence = (typeof CHAT_CONFIDENCES)[number];

export interface ChatCitation {
  sourceId: string;
  title: string;
  sourceUrl?: string;
  snippet: string;
}

export interface ChatHypothesis {
  cause: string;
  confidence: number;
  evidence: string;
}

export interface ChatSuggestedFix {
  title: string;
  description: string;
  commandOrPatch?: string;
  priority: "P0" | "P1" | "P2";
}

export interface ChatMessageMetadata {
  timeline?: string[];
  citations?: ChatCitation[];
  hypotheses?: ChatHypothesis[];
  suggestedFixes?: ChatSuggestedFix[];
}

/* -------------------------------------------------------------------------- */
/* Conversations & Messages (Multi-tenant, Forced RLS on org_id)              */
/* -------------------------------------------------------------------------- */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Links 1:1 with LangGraph PostgresSaver checkpoint thread */
    threadId: text("thread_id").notNull().unique(),
    title: text("title").notNull().default("New evaluation"),
    mode: text("mode", { enum: CHAT_MODES }).notNull().default("incident"),
    incidentId: uuid("incident_id").references(() => incidents.id, {
      onDelete: "set null",
    }),
    messageCount: integer("message_count").notNull().default(0),
    lastMessagePreview: text("last_message_preview"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("conversations_org_user_updated_idx").on(
      t.orgId,
      t.userId,
      t.updatedAt
    ),
    index("conversations_org_idx").on(t.orgId),
  ]
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: CHAT_ROLES }).notNull(),
    mode: text("mode", { enum: CHAT_MODES }).notNull().default("incident"),
    content: text("content").notNull(),
    confidence: text("confidence", { enum: CHAT_CONFIDENCES }),
    grounded: boolean("grounded"),
    metadata: jsonb("metadata").$type<ChatMessageMetadata>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("conversation_messages_conv_created_idx").on(
      t.conversationId,
      t.createdAt
    ),
    index("conversation_messages_org_idx").on(t.orgId),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;

import crypto from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  conversationMessages,
  conversations,
  withOrgContext,
  type ChatConfidence,
  type ChatMessageMetadata,
  type ChatMode,
  type ChatRole,
} from "../db";

function toPreview(content: string): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/[#>*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 140 ? `${plain.slice(0, 140)}…` : plain;
}

export async function createConversation(params: {
  orgId: string;
  userId: string;
  threadId?: string;
  mode?: ChatMode;
  title?: string;
  incidentId?: string | null;
}) {
  const mode = params.mode ?? "ask";
  const threadId =
    params.threadId?.trim() || `${mode}-${crypto.randomUUID()}`;

  return withOrgContext(params.orgId, async (tx) => {
    const [created] = await tx
      .insert(conversations)
      .values({
        orgId: params.orgId,
        userId: params.userId,
        threadId,
        title: params.title?.trim() || "New chat",
        mode,
        incidentId: params.incidentId ?? null,
      })
      .returning();

    return created!;
  });
}

export async function getOrCreateConversation(params: {
  orgId: string;
  userId: string;
  conversationId?: string;
  threadId?: string;
  mode?: ChatMode;
  incidentId?: string | null;
}) {
  return withOrgContext(params.orgId, async (tx) => {
    if (params.conversationId?.trim()) {
      const [byId] = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, params.conversationId.trim()),
            eq(conversations.orgId, params.orgId)
          )
        )
        .limit(1);
      if (byId) {
        if (params.incidentId && !byId.incidentId) {
          const [linked] = await tx
            .update(conversations)
            .set({
              incidentId: params.incidentId,
              mode: params.mode ?? byId.mode,
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, byId.id))
            .returning();
          return linked ?? byId;
        }
        return byId;
      }
    }

    if (params.threadId?.trim()) {
      const [byThread] = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.threadId, params.threadId.trim()),
            eq(conversations.orgId, params.orgId)
          )
        )
        .limit(1);
      if (byThread) return byThread;
    }

    const mode = params.mode ?? "ask";
    const threadId =
      params.threadId?.trim() || `${mode}-${crypto.randomUUID()}`;

    const [created] = await tx
      .insert(conversations)
      .values({
        orgId: params.orgId,
        userId: params.userId,
        threadId,
        title: "New chat",
        mode,
        incidentId: params.incidentId ?? null,
      })
      .returning();

    return created!;
  });
}

export async function listConversations(
  orgId: string,
  userId: string,
  limit = 50
) {
  return withOrgContext(orgId, async (tx) => {
    return tx
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.orgId, orgId), eq(conversations.userId, userId))
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(Math.min(limit, 100));
  });
}

export async function getConversationWithMessages(
  orgId: string,
  conversationId: string
) {
  return withOrgContext(orgId, async (tx) => {
    const [conversation] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, orgId)
        )
      )
      .limit(1);

    if (!conversation) return null;

    const messages = await tx
      .select()
      .from(conversationMessages)
      .where(
        and(
          eq(conversationMessages.conversationId, conversationId),
          eq(conversationMessages.orgId, orgId)
        )
      )
      .orderBy(asc(conversationMessages.createdAt));

    return { conversation, messages };
  });
}

export async function appendConversationMessage(params: {
  orgId: string;
  conversationId: string;
  role: ChatRole;
  mode: ChatMode;
  content: string;
  confidence?: ChatConfidence;
  grounded?: boolean;
  metadata?: ChatMessageMetadata;
}) {
  return withOrgContext(params.orgId, async (tx) => {
    const [message] = await tx
      .insert(conversationMessages)
      .values({
        orgId: params.orgId,
        conversationId: params.conversationId,
        role: params.role,
        mode: params.mode,
        content: params.content,
        confidence: params.confidence ?? null,
        grounded: params.grounded ?? null,
        metadata: params.metadata ?? {},
      })
      .returning();

    await tx
      .update(conversations)
      .set({
        mode: params.mode,
        messageCount: sql`${conversations.messageCount} + 1`,
        lastMessagePreview: toPreview(params.content),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, params.conversationId),
          eq(conversations.orgId, params.orgId)
        )
      );

    return message!;
  });
}

export async function updateConversationTitle(params: {
  orgId: string;
  conversationId: string;
  title: string;
}) {
  const cleanTitle = params.title.trim().slice(0, 80);
  if (!cleanTitle) return null;

  return withOrgContext(params.orgId, async (tx) => {
    const [updated] = await tx
      .update(conversations)
      .set({
        title: cleanTitle,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, params.conversationId),
          eq(conversations.orgId, params.orgId)
        )
      )
      .returning();

    return updated ?? null;
  });
}

export async function updateMessageApprovalDecision(params: {
  orgId: string;
  approvalId: string;
  decision: "approved" | "rejected";
}) {
  return withOrgContext(params.orgId, async (tx) => {
    await tx
      .update(conversationMessages)
      .set({
        metadata: sql`jsonb_set(coalesce(${conversationMessages.metadata}, '{}'::jsonb), '{approvalDecision}', to_jsonb(${params.decision}::text), true)`,
      })
      .where(
        and(
          eq(conversationMessages.orgId, params.orgId),
          sql`${conversationMessages.metadata}->>'approvalId' = ${params.approvalId}`
        )
      );
  });
}

export async function deleteConversation(
  orgId: string,
  conversationId: string
): Promise<boolean> {
  return withOrgContext(orgId, async (tx) => {
    const deleted = await tx
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, orgId)
        )
      )
      .returning({ id: conversations.id });
    return deleted.length > 0;
  });
}

export async function clearUserConversations(
  orgId: string,
  userId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .delete(conversations)
      .where(
        and(eq(conversations.orgId, orgId), eq(conversations.userId, userId))
      );
  });
}

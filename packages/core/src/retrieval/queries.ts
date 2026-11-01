import { and, desc, eq } from "drizzle-orm";
import { documentChunks, documents, withOrgContext } from "../db";
import type { ChunkMetadata } from "../db/schema";

// ─── Document Queries ─────────────────────────────────────────────

export async function checkIfDocumentExists(
  orgId: string,
  contentHash: string
): Promise<{ exists: boolean; documentId?: string }> {
  return withOrgContext(orgId, async (tx) => {
    const existing = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.contentHash, contentHash)
        )
      )
      .limit(1);

    if (existing[0]) {
      return { exists: true, documentId: existing[0].id };
    }
    return { exists: false };
  });
}

export async function saveDocument(params: {
  orgId: string;
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  contentHash?: string;
}): Promise<string> {
  return withOrgContext(params.orgId, async (tx) => {
    const inserted = await tx
      .insert(documents)
      .values({
        name: params.name,
        mimeType: params.mimeType,
        size: params.size,
        storageKey: params.storageKey,
        contentHash: params.contentHash ?? null,
        userId: params.userId,
        orgId: params.orgId,
        status: "pending",
      })
      .returning({ id: documents.id });

    const documentId = inserted[0]?.id;
    if (!documentId) {
      throw new Error(`Failed to create document record for ${params.name}`);
    }
    return documentId;
  });
}

export async function saveDocumentChunks(params: {
  orgId: string;
  documentId: string;
  chunks: Array<{
    content: string;
    chunkIndex: number;
    metadata: ChunkMetadata;
    embedding: number[];
  }>;
}): Promise<void> {
  if (params.chunks.length === 0) return;

  await withOrgContext(params.orgId, async (tx) => {
    await tx.insert(documentChunks).values(
      params.chunks.map((chunk) => ({
        documentId: params.documentId,
        orgId: params.orgId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        metadata: chunk.metadata,
        embedding: chunk.embedding,
      }))
    );
  });
}

export async function markDocumentIndexed(
  orgId: string,
  documentId: string,
  chunkCount: number
): Promise<void> {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .update(documents)
      .set({
        status: "indexed",
        chunkCount,
        processedAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where(
        and(eq(documents.id, documentId), eq(documents.orgId, orgId))
      );
  });
}

export async function markDocumentFailed(
  orgId: string,
  documentId: string,
  errorMessage: string
): Promise<void> {
  await withOrgContext(orgId, async (tx) => {
    await tx
      .update(documents)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(
        and(eq(documents.id, documentId), eq(documents.orgId, orgId))
      );
  });
}

export async function listDocuments(orgId: string) {
  return withOrgContext(orgId, async (tx) => {
    return tx
      .select({
        id: documents.id,
        orgId: documents.orgId,
        userId: documents.userId,
        name: documents.name,
        mimeType: documents.mimeType,
        size: documents.size,
        storageKey: documents.storageKey,
        contentHash: documents.contentHash,
        status: documents.status,
        errorMessage: documents.errorMessage,
        chunkCount: documents.chunkCount,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        processedAt: documents.processedAt,
      })
      .from(documents)
      .where(eq(documents.orgId, orgId))
      .orderBy(desc(documents.createdAt));
  });
}

// ─── Delete Queries ───────────────────────────────────────────────

/**
 * Deletes a document and all associated chunks for an organization.
 */
export async function deleteDocument(
  orgId: string,
  documentId: string
): Promise<{ id: string; storageKey: string } | null> {
  return withOrgContext(orgId, async (tx) => {
    const ownedDocument = await tx
      .select({
        id: documents.id,
        storageKey: documents.storageKey,
      })
      .from(documents)
      .where(
        and(eq(documents.id, documentId), eq(documents.orgId, orgId))
      )
      .limit(1);

    if (ownedDocument.length === 0) {
      return null;
    }

    await tx
      .delete(documentChunks)
      .where(
        and(
          eq(documentChunks.documentId, documentId),
          eq(documentChunks.orgId, orgId)
        )
      );

    const deleted = await tx
      .delete(documents)
      .where(
        and(eq(documents.id, documentId), eq(documents.orgId, orgId))
      )
      .returning({
        id: documents.id,
        storageKey: documents.storageKey,
      });

    return deleted[0] ?? null;
  });
}

import { and, eq } from "drizzle-orm";
import { documentChunks, documents, withOrgContext } from "../db";
import {
  computeContentHash,
  embedChunks,
  generateChunks,
  processPdf,
} from "./utils";

type IngestDocumentParams = {
  body: Buffer;
  name: string;
  mimeType: string;
  userId: string;
  orgId: string;
  storageKey: string;
};

export async function ingestDocument(params: IngestDocumentParams): Promise<{
  skipped: boolean;
  documentId: string;
  chunkCount?: number;
  reason?: string;
}> {
  if (params.mimeType !== "application/pdf") {
    throw new Error(
      `Unsupported document type for ingestion: ${params.mimeType}`,
    );
  }

  const contentHash = computeContentHash(params.body);
  let documentId: string | undefined;

  try {
    const created = await withOrgContext(params.orgId, async (tx) => {
      const existing = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.orgId, params.orgId),
            eq(documents.contentHash, contentHash),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return {
          skipped: true,
          documentId: existing[0].id,
          reason: "Document already exists",
        };
      }

      const inserted = await tx
        .insert(documents)
        .values({
          name: params.name,
          mimeType: params.mimeType,
          size: params.body.length,
          storageKey: params.storageKey,
          contentHash,
          userId: params.userId,
          orgId: params.orgId,
          status: "pending",
        })
        .returning({ id: documents.id });

      documentId = inserted[0]?.id;
      if (!documentId) {
        throw new Error(`Failed to create document record for ${params.name}`);
      }

      return { skipped: false, documentId };
    });

    if (created.skipped) {
      return created;
    }

    const pages = await processPdf(
      params.body,
      created.documentId,
      undefined,
      params.storageKey,
      params.name,
    );
    const chunks = await generateChunks(pages);
    const embeddings = await embedChunks(chunks);

    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Embedding count mismatch for document ${created.documentId}: ` +
          `${embeddings.length} embeddings for ${chunks.length} chunks`,
      );
    }

    await withOrgContext(params.orgId, async (tx) => {
      if (chunks.length > 0) {
        await tx.insert(documentChunks).values(
          chunks.map((chunk, index) => ({
            documentId: created.documentId,
            orgId: params.orgId,
            content: chunk.pageContent,
            chunkIndex: index,
            metadata: chunk.metadata,
            embedding: embeddings[index],
          })),
        );
      }

      await tx
        .update(documents)
        .set({
          status: "indexed",
          chunkCount: chunks.length,
          processedAt: new Date(),
          updatedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(documents.id, created.documentId));
    });

    return {
      skipped: false,
      documentId: created.documentId,
      chunkCount: chunks.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (documentId) {
      await withOrgContext(params.orgId, (tx) =>
        tx
          .update(documents)
          .set({
            status: "failed",
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, documentId!)),
      );
    }
    throw error;
  }
}

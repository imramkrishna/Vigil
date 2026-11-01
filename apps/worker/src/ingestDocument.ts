import {
  embedChunks,
  generateChunks,
  markDocumentFailed,
  markDocumentIndexed,
  processPdf,
  saveDocumentChunks,
} from "@vigil/core";

export type IngestDocumentParams = {
  documentUrl: string;
  documentId: string;
  orgId: string;
};

export async function ingestDocument(params: IngestDocumentParams): Promise<{
  documentId: string;
  chunkCount: number;
}> {
  const { documentUrl, documentId, orgId } = params;

  try {
    // 1. Parse PDF directly from public documentUrl, split into chunks, and embed
    const pages = await processPdf(documentUrl, documentId);
    const chunks = await generateChunks(pages);
    const embeddings = await embedChunks(chunks);

    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Embedding count mismatch for document ${documentId}: ` +
          `${embeddings.length} embeddings for ${chunks.length} chunks`,
      );
    }

    // 2. Save chunks and mark document as indexed
    await saveDocumentChunks({
      orgId,
      documentId,
      chunks: chunks.map((chunk, index) => ({
        content: chunk.pageContent,
        chunkIndex: index,
        metadata: chunk.metadata,
        embedding: embeddings[index]!,
      })),
    });

    await markDocumentIndexed(orgId, documentId, chunks.length);

    return {
      documentId,
      chunkCount: chunks.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("Error in ingestDocument : ", message);
    throw error;
  }
}

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { documentChunks, withOrgContext } from "../db";
import { getEmbeddingModel } from "../model-layer";
import type { ChunkMetadata } from "../db/schema";

const RRF_K = 60;

export type SearchResult = {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: ChunkMetadata | null;
  score: number;
};

const embeddingModel = getEmbeddingModel();

export async function semanticSearch(
  orgId: string,
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  if (limit <= 0) return [];

  const [queryEmbedding] = await embeddingModel.embedDocuments([query]);
  if (!queryEmbedding) {
    throw new Error("Failed to generate an embedding for the search query");
  }

  return withOrgContext(orgId, async (tx) => {
    const vector = sql`${JSON.stringify(queryEmbedding)}::vector`;
    const distance = sql<number>`${documentChunks.embedding} <=> ${vector}`;
    const rows = await tx
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        metadata: documentChunks.metadata,
        score: sql<number>`1 - (${distance})`,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.orgId, orgId),
          isNotNull(documentChunks.embedding),
        ),
      )
      .orderBy(distance)
      .limit(limit);

    return rows;
  });
}

export async function textSearch(
  orgId: string,
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  if (limit <= 0) return [];

  return withOrgContext(orgId, async (tx) => {
    const queryVector = sql`plainto_tsquery('english', ${query})`;
    const rank = sql<number>`${documentChunks.tsv} @@ ${queryVector}`;
    const score = sql<number>`ts_rank_cd(${documentChunks.tsv}, ${queryVector})`;
    const rows = await tx
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        metadata: documentChunks.metadata,
        score,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.orgId, orgId),
          isNotNull(documentChunks.tsv),
          rank,
        ),
      )
      .orderBy(desc(score))
      .limit(limit);

    return rows;
  });
}

export async function hybridSearch(
  orgId: string,
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  if (limit <= 0) return [];

  const candidateLimit = Math.max(limit, limit * 2);
  const [semanticResults, lexicalResults] = await Promise.all([
    semanticSearch(orgId, query, candidateLimit),
    textSearch(orgId, query, candidateLimit),
  ]);

  const fused = new Map<string, SearchResult>();

  const addRankedResults = (results: SearchResult[]) => {
    results.forEach((result, index) => {
      const current = fused.get(result.id);
      const rrfScore = 1 / (RRF_K + index + 1);

      if (current) {
        current.score += rrfScore;
      } else {
        fused.set(result.id, { ...result, score: rrfScore });
      }
    });
  };

  addRankedResults(semanticResults);
  addRankedResults(lexicalResults);

  return [...fused.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

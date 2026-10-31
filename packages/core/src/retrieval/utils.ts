import crypto from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import type { ChunkMetadata } from "../db/schema";
import { PDFParse } from "pdf-parse";

export type chunkMetadata = ChunkMetadata;

export interface chunk {
  id: string;
  chunk: string;
  chunkIndex: number;
  documentId: string;
  metadata: chunkMetadata;
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1200,
  chunkOverlap: 150,
});

/**
 * Generates a deterministic 64-character SHA-256 hex digest of document content.
 */
export function computeContentHash(content: string | Buffer): string {
  const normalized =
    typeof content === "string"
      ? content.replace(/\r\n/g, "\n").trim()
      : content;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Fetches text content from an HTTP(S) URL.
 */
export async function getTextFromUrl(sourceUrl: string): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch document from URL (${response.status} ${response.statusText}): ${sourceUrl}`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("utf-8");
}

export async function processPdf(url: string, documentId?: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();
    const pages = result.pages;
    const pageDocuments = pages.map((page) => {
      return new Document({
        pageContent: page.text,
        metadata: {
          page: page.num,
          sourceUrl: url,
          documentId,
        },
      });
    });
    return pageDocuments;
  } finally {
    await parser.destroy();
  }
}
export async function generateChunks(
  documentText: Document[],
): Promise<Document[]> {
  const chunks = await splitter.splitDocuments(documentText);
  const totalChunks = chunks.length;

  return chunks.map((chunk, chunkIndex) => {
    chunk.metadata = {
      ...chunk.metadata,
      chunkIndex,
      totalChunks,
    };
    return chunk;
  });
}

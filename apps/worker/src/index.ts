import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { INJESTION_QUEUE, type IngestionJobData } from "./types";
import { ingestDocument } from "./ingestDocument";
import { markDocumentFailed } from "@vigil/core";

export const injestionWorker = new Worker<IngestionJobData>(
  INJESTION_QUEUE,
  async (job) => {
    const { documentUrl, documentId, orgId } = job.data;
    try {
      return await ingestDocument({
        documentUrl,
        documentId,
        orgId,
      });
    } catch (error) {
      console.error("Error while ingesting document : ", {
        documentId,
        attemptsMade: job.attemptsMade,
        error,
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
  },
);

injestionWorker.on("completed", (job) => {
  console.log(
    `[Worker] Completed ingestion job ${job.id} for document ${job.data.documentId}`,
  );
});

injestionWorker.on("failed", async (job, err) => {
  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 2;
  const isFinalFailure = job?.attemptsMade >= maxAttempts;
  if (isFinalFailure) {
    console.error(
      `[Worker] Failed ingestion job ${job?.id} for document ${job?.data.documentId}:`,
      err.message,
    );
    await markDocumentFailed(job.data.orgId, job.data.documentId, err.message);
  }
});

console.log("👷 Worker is running and waiting for jobs.");

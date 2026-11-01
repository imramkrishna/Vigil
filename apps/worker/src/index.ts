import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { INJESTION_QUEUE, type IngestionJobData } from "./types";
import { ingestDocument } from "./ingestDocument";

export const injestionWorker = new Worker<IngestionJobData>(
  INJESTION_QUEUE,
  async (job) => {
    const { documentUrl, documentId, orgId } = job.data;
    try {
      return ingestDocument({
        documentUrl,
        documentId,
        orgId,
      });
    } catch (error) {
      console.error("Error while ingesting document : ", {
        documentId,
      });
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

injestionWorker.on("failed", (job, err) => {
  console.error(
    `[Worker] Failed ingestion job ${job?.id} for document ${job?.data.documentId}:`,
    err.message,
  );
});

console.log("👷 Worker is running and waiting for jobs.");

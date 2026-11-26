import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import {
  INJESTION_QUEUE,
  LOG_RETENTION_QUEUE,
  type IngestionJobData,
  type LogRetentionJobData,
} from "./types";
import { ingestDocument } from "./ingestDocument";
import { logRetentionQueue } from "./queue";
import { markDocumentFailed, pruneExpiredServiceLogs } from "@vigil/core";

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

/** Daily retention worker pruning ops_service_logs older than 14 days. */
export const logRetentionWorker = new Worker<LogRetentionJobData>(
  LOG_RETENTION_QUEUE,
  async (job) => {
    const retentionDays = job.data?.retentionDays ?? 14;
    const pruned = await pruneExpiredServiceLogs(retentionDays);
    console.log(
      `[Worker] Pruned ${pruned} expired ops_service_logs rows (> ${retentionDays} days).`
    );
    return { pruned };
  },
  {
    connection: redisConnection,
  }
);

logRetentionQueue
  .upsertJobScheduler(
    "daily-ops-service-logs-retention",
    { pattern: "0 3 * * *" },
    {
      name: "prune-ops-service-logs",
      data: { retentionDays: 14 },
    }
  )
  .catch((err) => {
    console.error("[Worker] Failed to schedule daily log retention job:", err);
  });

console.log("👷 Worker is running and waiting for jobs.");

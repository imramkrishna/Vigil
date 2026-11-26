import { Queue } from "bullmq";
import { redisConnection } from "./redis";
import {
  INJESTION_QUEUE,
  LOG_RETENTION_QUEUE,
  type IngestionJobData,
  type LogRetentionJobData,
} from "./types";

export const injestionQueue = new Queue<IngestionJobData>(INJESTION_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 20000,
    },
  },
});

export const logRetentionQueue = new Queue<LogRetentionJobData>(
  LOG_RETENTION_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 10,
      removeOnFail: 20,
    },
  }
);

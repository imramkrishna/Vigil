import { Queue } from "bullmq";
import { redisConnection } from "./redis";
import { INJESTION_QUEUE, type IngestionJobData } from "./types";

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

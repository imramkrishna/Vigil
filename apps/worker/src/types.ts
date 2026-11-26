export const INJESTION_QUEUE = "injestion-queue";
export const LOG_RETENTION_QUEUE = "log-retention-queue";

export interface IngestionJobData {
  documentUrl: string;
  documentId: string;
  orgId: string;
}

export interface LogRetentionJobData {
  retentionDays?: number;
}

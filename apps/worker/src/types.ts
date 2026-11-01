export const INJESTION_QUEUE = "injestion-queue";

export interface IngestionJobData {
  documentUrl: string;
  documentId: string;
  orgId: string;
}

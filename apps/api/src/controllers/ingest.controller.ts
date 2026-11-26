import type { Request, Response } from "express";
import {
  ingestServiceLogs,
  resolveIngestTokenIntegration,
  type IngestLogInput,
} from "@vigil/core";

const MAX_BATCH_SIZE = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

const orgRateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkOrgRateLimit(orgId: string): boolean {
  const now = Date.now();
  const bucket = orgRateBuckets.get(orgId);
  if (!bucket || now >= bucket.resetAt) {
    orgRateBuckets.set(orgId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  bucket.count += 1;
  return true;
}

/**
 * POST /api/ingest/logs
 * Authenticated via `X-Vigil-Ingest-Key` (SHA-256 hashed in `org_integrations`).
 * Accepts up to 500 log lines per request for generic Linux VPS shippers & log drains.
 */
export async function ingestLogsController(req: Request, res: Response) {
  try {
    const rawKey = req.header("x-vigil-ingest-key")?.trim();
    if (!rawKey) {
      res.status(401).json({ error: "Missing X-Vigil-Ingest-Key header." });
      return;
    }

    const authMatch = await resolveIngestTokenIntegration(rawKey);
    if (!authMatch) {
      res.status(401).json({ error: "Invalid or revoked X-Vigil-Ingest-Key." });
      return;
    }

    if (!checkOrgRateLimit(authMatch.orgId)) {
      res.status(429).json({
        error: "Rate limit exceeded for log ingestion. Retry after 60 seconds.",
      });
      return;
    }

    const body = req.body as {
      service?: string;
      logs?: IngestLogInput[];
    };

    if (!body?.service || !body.service.trim()) {
      res.status(400).json({ error: "Field 'service' is required." });
      return;
    }

    if (!Array.isArray(body.logs) || body.logs.length === 0) {
      res
        .status(400)
        .json({ error: "Field 'logs' must be a non-empty array of log entries." });
      return;
    }

    if (body.logs.length > MAX_BATCH_SIZE) {
      res.status(400).json({
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} log lines per request.`,
      });
      return;
    }

    const result = await ingestServiceLogs({
      orgId: authMatch.orgId,
      integrationId: authMatch.integrationId,
      serviceName: body.service,
      logs: body.logs,
    });

    res.status(202).json({
      accepted: true,
      ingested: result.ingested,
      serviceId: result.serviceId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to ingest logs";
    res.status(500).json({ error: message });
  }
}

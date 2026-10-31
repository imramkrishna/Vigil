import type { DeploymentPlatform, PlatformConfig } from "../db/schema";
import { getPastIncidents, getRecentDeploys, getServiceByName } from "./queries";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  platform?: DeploymentPlatform;
  level: LogLevel;
  message: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface FetchLogsParams {
  orgId: string;
  service?: string;
  level?: LogLevel;
  keyword?: string;
  sinceMinutes?: number;
  limit?: number;
}

export interface FetchLiveLogsParams {
  orgId: string;
  service?: string;
  level?: LogLevel;
  lines?: number;
}

/**
 * Fetches historical/filtered logs for a service based on its configured deployment platform
 * (`cloud_run`, `aws_lambda`, `aws_ec2`, `render`, `vercel`).
 */
export async function fetchLogs(params: FetchLogsParams): Promise<LogEntry[]> {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const sinceMinutes = params.sinceMinutes ?? 60;
  const startTimeMs = Date.now() - sinceMinutes * 60_000;

  return resolveAndFetchPlatformLogs({
    orgId: params.orgId,
    service: params.service,
    level: params.level,
    keyword: params.keyword,
    startTimeMs,
    limit,
    liveTail: false,
  });
}

/**
 * Fetches the freshest live tail of logs (last N lines over the recent window)
 * for a service based on its configured deployment platform.
 */
export async function fetchLiveLogs(
  params: FetchLiveLogsParams
): Promise<LogEntry[]> {
  const lines = Math.min(Math.max(params.lines ?? 20, 1), 100);
  const startTimeMs = Date.now() - 5 * 60_000; // last 5 minutes for live tail

  return resolveAndFetchPlatformLogs({
    orgId: params.orgId,
    service: params.service,
    level: params.level,
    startTimeMs,
    limit: lines,
    liveTail: true,
  });
}

async function resolveAndFetchPlatformLogs(opts: {
  orgId: string;
  service?: string;
  level?: LogLevel;
  keyword?: string;
  startTimeMs: number;
  limit: number;
  liveTail: boolean;
}): Promise<LogEntry[]> {
  if (opts.service) {
    const matchedServices = await getServiceByName(opts.orgId, opts.service);
    const target = matchedServices[0];

    if (target?.platform && target?.platformConfig) {
      const providerLogs = await dispatchPlatformAdapter(
        target.name,
        target.logUrl ?? target.platformConfig.logUrl,
        target.platformConfig,
        opts
      );
      if (providerLogs) {
        return providerLogs;
      }
    } else if (target?.logUrl) {
      const customLogs = await fetchCustomUrlLogs(
        target.name,
        target.platform ?? "custom",
        target.logUrl,
        opts
      );
      if (customLogs) {
        return customLogs;
      }
    }
  }

  return buildCorrelatedLogs(opts.orgId, {
    service: opts.service,
    level: opts.level,
    keyword: opts.keyword,
    limit: opts.limit,
    liveTail: opts.liveTail,
  });
}

async function dispatchPlatformAdapter(
  serviceName: string,
  logUrl: string | undefined,
  config: PlatformConfig,
  opts: {
    level?: LogLevel;
    keyword?: string;
    startTimeMs: number;
    limit: number;
  }
): Promise<LogEntry[] | null> {
  switch (config.platform) {
    case "cloud_run":
      return fetchCloudRunLogs(serviceName, logUrl, config, opts);
    case "aws_lambda":
      return fetchAwsCloudWatchLogs(
        serviceName,
        "aws_lambda",
        logUrl,
        config.region,
        config.logGroupName ?? `/aws/lambda/${config.functionName}`,
        opts
      );
    case "aws_ec2":
      return fetchAwsCloudWatchLogs(
        serviceName,
        "aws_ec2",
        logUrl,
        config.region,
        config.logGroupName,
        opts
      );
    case "render":
      return fetchRenderLogs(serviceName, logUrl, config, opts);
    case "vercel":
      return fetchVercelLogs(serviceName, logUrl, config, opts);
    case "custom":
      return fetchCustomUrlLogs(
        serviceName,
        "custom",
        logUrl ?? config.logUrl,
        opts
      );
    default:
      return null;
  }
}

/** 1. Google Cloud Run (Cloud Logging REST API `entries:list` or user-provided logUrl) */
async function fetchCloudRunLogs(
  serviceName: string,
  logUrl: string | undefined,
  config: Extract<PlatformConfig, { platform: "cloud_run" }>,
  opts: { level?: LogLevel; keyword?: string; startTimeMs: number; limit: number }
): Promise<LogEntry[] | null> {
  const token = process.env.GCP_ACCESS_TOKEN;
  const endpoint = logUrl ?? "https://logging.googleapis.com/v2/entries:list";
  if (!token && !logUrl) return null;

  const filterParts = [
    `resource.type="cloud_run_revision"`,
    `resource.labels.service_name="${config.serviceName}"`,
    `timestamp>="${new Date(opts.startTimeMs).toISOString()}"`,
  ];
  if (opts.level) {
    filterParts.push(`severity>=${opts.level.toUpperCase()}`);
  }
  if (opts.keyword) {
    filterParts.push(`textPayload:"${opts.keyword.replace(/"/g, '\\"')}"`);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resourceNames: [`projects/${config.projectId}`],
      filter: filterParts.join(" AND "),
      orderBy: "timestamp desc",
      pageSize: opts.limit,
    }),
  });

  if (!res.ok) {
    throw new Error(`Cloud Run logs error (${res.status} ${res.statusText})`);
  }

  const data = (await res.json()) as {
    entries?: Array<{
      insertId?: string;
      timestamp?: string;
      severity?: string;
      textPayload?: string;
      jsonPayload?: Record<string, unknown>;
      trace?: string;
    }>;
  };

  return (data.entries ?? []).map((entry, idx) => ({
    id: entry.insertId ?? `gcp-${idx}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    service: serviceName,
    platform: "cloud_run",
    level: normalizeLevel(entry.severity),
    message:
      entry.textPayload ??
      JSON.stringify(entry.jsonPayload ?? "Cloud Run log entry"),
    traceId: entry.trace,
    metadata: entry.jsonPayload,
  }));
}

/** 2 & 3. AWS Lambda and AWS EC2 (via user-provided logUrl or CloudWatch Logs endpoint) */
async function fetchAwsCloudWatchLogs(
  serviceName: string,
  platform: "aws_lambda" | "aws_ec2",
  logUrl: string | undefined,
  region: string,
  logGroupName: string,
  opts: { level?: LogLevel; keyword?: string; startTimeMs: number; limit: number }
): Promise<LogEntry[] | null> {
  const endpoint = logUrl ?? process.env.AWS_CLOUDWATCH_LOGS_URL;
  if (!endpoint) return null;

  const filterTerms = [opts.level?.toUpperCase(), opts.keyword].filter(Boolean);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.AWS_CLOUDWATCH_TOKEN
        ? { Authorization: `Bearer ${process.env.AWS_CLOUDWATCH_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      region,
      logGroupName,
      startTime: opts.startTimeMs,
      filterPattern: filterTerms.join(" "),
      limit: opts.limit,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `AWS CloudWatch (${platform}) logs error (${res.status} ${res.statusText})`
    );
  }

  const data = (await res.json()) as {
    events?: Array<{
      eventId?: string;
      timestamp?: number;
      message?: string;
      logStreamName?: string;
    }>;
  };

  return (data.events ?? []).map((ev, idx) => ({
    id: ev.eventId ?? `cw-${idx}`,
    timestamp: ev.timestamp
      ? new Date(ev.timestamp).toISOString()
      : new Date().toISOString(),
    service: serviceName,
    platform,
    level: inferLevelFromMessage(ev.message ?? "", opts.level),
    message: (ev.message ?? "").trim(),
    metadata: { logGroupName, logStreamName: ev.logStreamName },
  }));
}

/** 4. Render (`GET https://api.render.com/v1/logs` or user-provided logUrl) */
async function fetchRenderLogs(
  serviceName: string,
  logUrl: string | undefined,
  config: Extract<PlatformConfig, { platform: "render" }>,
  opts: { level?: LogLevel; keyword?: string; startTimeMs: number; limit: number }
): Promise<LogEntry[] | null> {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey && !logUrl) return null;

  const url = new URL(logUrl ?? "https://api.render.com/v1/logs");
  url.searchParams.set("resource", config.serviceId);
  if (config.ownerId) url.searchParams.set("ownerId", config.ownerId);
  url.searchParams.set("startTime", new Date(opts.startTimeMs).toISOString());
  url.searchParams.set("limit", String(opts.limit));
  if (opts.level) url.searchParams.set("level", opts.level);
  if (opts.keyword) url.searchParams.set("text", opts.keyword);

  const res = await fetch(url.toString(), {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Render logs error (${res.status} ${res.statusText})`);
  }

  const data = (await res.json()) as {
    logs?: Array<{
      id?: string;
      timestamp?: string;
      level?: string;
      message?: string;
    }>;
  };

  return (data.logs ?? []).map((row, idx) => ({
    id: row.id ?? `render-${idx}`,
    timestamp: row.timestamp ?? new Date().toISOString(),
    service: serviceName,
    platform: "render",
    level: normalizeLevel(row.level),
    message: row.message ?? "",
  }));
}

/** 5. Vercel (`GET https://api.vercel.com/v3/deployments/{id}/events` or user-provided logUrl) */
async function fetchVercelLogs(
  serviceName: string,
  logUrl: string | undefined,
  config: Extract<PlatformConfig, { platform: "vercel" }>,
  opts: { level?: LogLevel; keyword?: string; startTimeMs: number; limit: number }
): Promise<LogEntry[] | null> {
  const token = process.env.VERCEL_TOKEN;
  const baseEndpoint =
    logUrl ??
    (config.deploymentId
      ? `https://api.vercel.com/v3/deployments/${config.deploymentId}/events`
      : null);
  if (!baseEndpoint || (!token && !logUrl)) return null;

  const url = new URL(baseEndpoint);
  if (config.teamId) url.searchParams.set("teamId", config.teamId);
  url.searchParams.set("since", String(opts.startTimeMs));
  url.searchParams.set("limit", String(opts.limit));

  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    throw new Error(`Vercel logs error (${res.status} ${res.statusText})`);
  }

  const events = (await res.json()) as Array<{
    id?: string;
    created?: number;
    type?: string;
    payload?: { text?: string; statusCode?: number };
  }>;

  return events
    .map((ev, idx) => {
      const text = ev.payload?.text ?? "";
      return {
        id: ev.id ?? `vercel-${idx}`,
        timestamp: ev.created
          ? new Date(ev.created).toISOString()
          : new Date().toISOString(),
        service: serviceName,
        platform: "vercel" as const,
        level: inferLevelFromMessage(text, opts.level),
        message: text,
      };
    })
    .filter((entry) => {
      if (opts.level && entry.level !== opts.level) return false;
      if (
        opts.keyword &&
        !entry.message.toLowerCase().includes(opts.keyword.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .slice(0, opts.limit);
}

/** 6. Custom / direct user-provided logUrl */
async function fetchCustomUrlLogs(
  serviceName: string,
  platform: DeploymentPlatform,
  logUrl: string,
  opts: { level?: LogLevel; keyword?: string; startTimeMs: number; limit: number }
): Promise<LogEntry[] | null> {
  const url = new URL(logUrl);
  url.searchParams.set("service", serviceName);
  url.searchParams.set("since", new Date(opts.startTimeMs).toISOString());
  url.searchParams.set("limit", String(opts.limit));
  if (opts.level) url.searchParams.set("level", opts.level);
  if (opts.keyword) url.searchParams.set("keyword", opts.keyword);

  const res = await fetch(url.toString(), {
    headers: process.env.LOG_PROVIDER_TOKEN
      ? { Authorization: `Bearer ${process.env.LOG_PROVIDER_TOKEN}` }
      : undefined,
  });

  if (!res.ok) {
    throw new Error(`Custom logUrl error (${res.status} ${res.statusText})`);
  }

  const data = (await res.json()) as
    | { logs?: Array<Partial<LogEntry>> }
    | Array<Partial<LogEntry>>;
  const list = Array.isArray(data) ? data : (data.logs ?? []);

  return list.slice(0, opts.limit).map((item, idx) => ({
    id: item.id ?? `custom-${idx}`,
    timestamp: item.timestamp ?? new Date().toISOString(),
    service: item.service ?? serviceName,
    platform,
    level: normalizeLevel(item.level),
    message: item.message ?? JSON.stringify(item),
    traceId: item.traceId,
    metadata: item.metadata,
  }));
}

function normalizeLevel(raw?: string): LogLevel {
  const val = (raw ?? "").toLowerCase();
  if (val.includes("fatal") || val.includes("crit")) return "fatal";
  if (val.includes("err")) return "error";
  if (val.includes("warn")) return "warn";
  if (val.includes("debug")) return "debug";
  return "info";
}

function inferLevelFromMessage(message: string, fallback?: LogLevel): LogLevel {
  const lower = message.toLowerCase();
  if (lower.includes("fatal")) return "fatal";
  if (lower.includes("error") || lower.includes("exception")) return "error";
  if (lower.includes("warn")) return "warn";
  return fallback ?? "info";
}

async function buildCorrelatedLogs(
  orgId: string,
  opts: {
    service?: string;
    level?: LogLevel;
    keyword?: string;
    limit: number;
    liveTail?: boolean;
  }
): Promise<LogEntry[]> {
  const [deploys, incidents] = await Promise.all([
    getRecentDeploys(orgId, opts.service, 5),
    getPastIncidents(orgId, {
      service: opts.service,
      keyword: opts.keyword,
      limit: 5,
    }),
  ]);

  const now = Date.now();
  const entries: LogEntry[] = [];

  for (const [idx, deploy] of deploys.entries()) {
    const level: LogLevel =
      deploy.status === "failed"
        ? "error"
        : deploy.status === "rolled_back"
          ? "warn"
          : "info";

    entries.push({
      id: `log-deploy-${deploy.id}`,
      timestamp: opts.liveTail
        ? new Date(now - idx * 4_000).toISOString()
        : deploy.deployedAt.toISOString(),
      service: deploy.service,
      level,
      message: `Deploy sha=${deploy.sha} status=${deploy.status} by ${deploy.author ?? "ci"}`,
      traceId: `tr-${deploy.sha.slice(0, 8)}`,
      metadata: {
        sha: deploy.sha,
        status: deploy.status,
        configDiff: deploy.configDiff ?? {},
      },
    });
  }

  for (const [idx, inc] of incidents.entries()) {
    entries.push({
      id: `log-inc-${inc.id}`,
      timestamp: opts.liveTail
        ? new Date(now - (idx + 1) * 2_500).toISOString()
        : inc.occurredAt.toISOString(),
      service: inc.service,
      level: "error",
      message: `[${inc.id}] ${inc.summary}${inc.rootCause ? ` | cause: ${inc.rootCause}` : ""}`,
      traceId: `tr-${inc.id.toLowerCase()}`,
      metadata: {
        incidentId: inc.id,
        rootCause: inc.rootCause,
      },
    });
  }

  return entries
    .filter((entry) => {
      if (opts.level && entry.level !== opts.level) return false;
      if (
        opts.keyword &&
        !entry.message.toLowerCase().includes(opts.keyword.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .slice(0, opts.limit);
}

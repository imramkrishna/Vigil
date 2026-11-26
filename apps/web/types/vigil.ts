export type Mode = "incident";
export type Severity = "SEV-1" | "SEV-2" | "SEV-3";
export type Confidence = "high" | "medium" | "low";
export type DeploymentPlatform =
  | "cloud_run"
  | "gcp_vm"
  | "aws_lambda"
  | "aws_ec2"
  | "render"
  | "vercel"
  | "vps"
  | "custom";

export type IntegrationProvider = "gcp" | "aws" | "render" | "vercel" | "vps";
export type IntegrationAuthMethod =
  | "iam_delegation"
  | "sts_assume_role"
  | "service_account_json"
  | "api_key"
  | "ingest_token";
export type IntegrationStatus = "pending" | "connected" | "error";

export interface OrgIntegrationRow {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  name: string;
  authMethod: IntegrationAuthMethod;
  publicConfig: Record<string, unknown>;
  status: IntegrationStatus;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceLogEntry {
  id: string;
  timestamp: string;
  service: string;
  platform?: DeploymentPlatform;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface Citation {
  sourceId: string;
  title: string;
  sourceUrl?: string;
  snippet: string;
}

export interface Hypothesis {
  cause: string;
  confidence: number; // 0.0 to 1.0
  evidence: string;
}

export interface SuggestedFix {
  title: string;
  description: string;
  commandOrPatch?: string;
  priority: "P0" | "P1" | "P2";
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  mode: Mode;
  content: string;
  createdAt: string;
  confidence?: Confidence;
  grounded?: boolean;
  timeline?: string[]; // Agent tool-call trace steps
  citations?: Citation[];
  hypotheses?: Hypothesis[];
  suggestedFixes?: SuggestedFix[];
}

export interface ServiceRegistrationPayload {
  name: string;
  integrationId?: string | null;
  tier: 1 | 2 | 3;
  owner: string;
  slackChannel: string;
  repoUrl: string;
  githubBranch: string;
  platform: DeploymentPlatform;
  logUrl: string;
  platformConfig: Record<string, string>;
}

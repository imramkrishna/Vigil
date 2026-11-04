export type Mode = "ask" | "incident" | "postmortem";
export type Severity = "SEV-1" | "SEV-2" | "SEV-3";
export type Confidence = "high" | "medium" | "low";
export type DeploymentPlatform = "cloud_run" | "aws_lambda" | "aws_ec2" | "render" | "vercel" | "custom";

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

export interface ProposedAction {
  kind: "create_ticket" | "post_status" | "schedule_followup";
  title: string;
  target: string;
  payload: Record<string, unknown>;
  rationale: string;
  evidenceIds: string[];
  idempotencyKey: string;
}

export interface ActionItem {
  title: string;
  owner: string;
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
  proposedAction?: ProposedAction | null;
  approvalId?: string | null;
  approvalDecision?: "pending" | "approved" | "rejected" | null;
  postmortemMarkdown?: string;
  actionItems?: ActionItem[];
}

export interface ServiceRegistrationPayload {
  name: string;
  tier: 1 | 2 | 3;
  owner: string;
  slackChannel: string;
  repoUrl: string;
  githubBranch: string;
  platform: DeploymentPlatform;
  logUrl: string;
  platformConfig: Record<string, string>;
}

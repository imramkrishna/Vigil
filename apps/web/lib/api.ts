import type {
  ActionItem,
  Citation,
  Hypothesis,
  ProposedAction,
  ServiceRegistrationPayload,
  Severity,
} from "../types/vigil";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: "viewer" | "responder" | "lead" | "admin";
}

export interface DocumentRow {
  id: string;
  orgId: string;
  name: string;
  sourceUrl: string;
  status: "pending" | "indexed" | "failed";
  errorMessage?: string | null;
  createdAt: string;
  indexedAt?: string | null;
}

export interface BudgetStatus {
  orgId: string;
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
  percentUsed: number;
  exceeded: boolean;
}

export interface IncidentRow {
  id: string;
  orgId: string;
  threadId: string;
  title: string;
  severity: Severity;
  status: "investigating" | "awaiting_approval" | "mitigating" | "resolved";
  openedBy?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
}

export interface ApprovalRow {
  id: string;
  incidentId: string;
  orgId: string;
  action: ProposedAction;
  decision: "pending" | "approved" | "rejected";
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

// ─── Auth & Session ──────────────────────────────────────────────────

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await apiFetch<{ user: AuthUser }>("/api/me");
    return res.user;
  } catch {
    return null;
  }
}

export async function signInEmail(email: string, password: string) {
  return apiFetch<{ user?: unknown; token?: string }>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signUpEmail(name: string, email: string, password: string) {
  return apiFetch<{ user?: unknown; token?: string }>("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function signOut() {
  try {
    await apiFetch("/api/auth/sign-out", {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    // ignore if offline
  }
}

// ─── Docs / Runbooks ─────────────────────────────────────────────────

export async function listDocs(): Promise<DocumentRow[]> {
  const res = await apiFetch<{ documents: DocumentRow[] }>("/api/docs");
  return res.documents ?? [];
}

export async function uploadDocPdf(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{
    message: string;
    documentId: string;
    documentUrl: string;
    status: string;
  }>("/api/docs/upload", {
    method: "POST",
    body: form,
  });
}

export async function deleteDoc(id: string) {
  return apiFetch<{ message: string }>(`/api/docs/${id}`, {
    method: "DELETE",
  });
}

// ─── Ops Services, Deploys & Budget ──────────────────────────────────

export async function getBudget(): Promise<BudgetStatus> {
  const res = await apiFetch<{ budget: BudgetStatus }>("/api/ops/budget");
  return res.budget;
}

export async function listServices() {
  const res = await apiFetch<{ services: Record<string, unknown>[] }>(
    "/api/ops/services"
  );
  return res.services ?? [];
}

export async function registerService(payload: ServiceRegistrationPayload) {
  const res = await apiFetch<{ service: Record<string, unknown> }>(
    "/api/ops/services",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return res.service;
}

export async function listDeploys(service?: string) {
  const q = service ? `?service=${encodeURIComponent(service)}` : "";
  return apiFetch<{
    deploys: Array<{
      service: string;
      sha: string;
      author: string;
      deployedAt: string;
      configDiff?: Record<string, unknown>;
      status: string;
    }>;
    pastIncidents: Array<Record<string, unknown>>;
  }>(`/api/ops/deploys${q}`);
}

// ─── Incidents, Approvals & Postmortems ──────────────────────────────

export async function listIncidents(): Promise<IncidentRow[]> {
  const res = await apiFetch<{ incidents: IncidentRow[] }>("/api/incidents");
  return res.incidents ?? [];
}

export async function createIncident(params: {
  title: string;
  severity?: Severity;
  service?: string;
  symptomSummary?: string;
}) {
  return apiFetch<{
    incident: IncidentRow;
    threadId: string;
    status: string;
    hypotheses: Hypothesis[];
    proposedAction: ProposedAction | null;
    answer: string;
    citations: Citation[];
    confidence: "high" | "medium" | "low";
    timeline: string[];
  }>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function generatePostmortem(incidentId: string) {
  return apiFetch<{
    incidentId: string;
    threadId: string;
    postmortemMarkdown: string;
    actionItems: ActionItem[];
    timeline: string[];
  }>(`/api/incidents/${incidentId}/postmortem`, {
    method: "POST",
  });
}

export async function listApprovals(
  decision?: "pending" | "approved" | "rejected"
): Promise<ApprovalRow[]> {
  const q = decision ? `?decision=${decision}` : "";
  const res = await apiFetch<{ approvals: ApprovalRow[] }>(
    `/api/approvals${q}`
  );
  return res.approvals ?? [];
}

export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected"
) {
  return apiFetch<{
    approval: ApprovalRow;
    incidentStatus: string;
    answer: string;
    timeline: string[];
  }>(`/api/approvals/${approvalId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export async function askCopilot(query: string, threadId?: string) {
  return apiFetch<{
    answer: string;
    citations: Citation[];
    confidence: "high" | "medium" | "low";
    grounded: boolean;
    timeline: string[];
    threadId: string;
  }>("/api/ask", {
    method: "POST",
    body: JSON.stringify({ query, threadId }),
  });
}

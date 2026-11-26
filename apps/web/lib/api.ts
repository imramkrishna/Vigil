import type {
  Citation,
  DeploymentPlatform,
  Hypothesis,
  IntegrationAuthMethod,
  IntegrationProvider,
  OrgIntegrationRow,
  ServiceLogEntry,
  ServiceRegistrationPayload,
  Severity,
  SuggestedFix,
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
  githubConnected?: boolean;
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

export interface IncidentRow {
  id: string;
  orgId: string;
  threadId: string;
  title: string;
  severity: Severity;
  status: "investigating" | "monitoring" | "resolved";
  openedBy?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
}

export interface ConversationRow {
  id: string;
  orgId: string;
  userId: string;
  threadId: string;
  title: string;
  mode: "incident";
  incidentId?: string | null;
  messageCount: number;
  lastMessagePreview?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageRow {
  id: string;
  orgId: string;
  conversationId: string;
  role: "user" | "assistant";
  mode: "incident";
  content: string;
  confidence?: "high" | "medium" | "low" | null;
  grounded?: boolean | null;
  metadata?: {
    timeline?: string[];
    citations?: Citation[];
    hypotheses?: Hypothesis[];
    suggestedFixes?: SuggestedFix[];
  } | null;
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

export async function signInWithGitHub(callbackURL?: string) {
  const redirectTarget =
    callbackURL ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/dashboard`
      : "http://localhost:3000/dashboard");

  const res = await apiFetch<{ url?: string; redirect?: boolean }>(
    "/api/auth/sign-in/social",
    {
      method: "POST",
      body: JSON.stringify({
        provider: "github",
        callbackURL: redirectTarget,
      }),
    }
  );

  if (res?.url && typeof window !== "undefined") {
    window.location.href = res.url;
  }
  return res;
}

export async function connectGitHubAccount(callbackURL?: string) {
  const redirectTarget =
    callbackURL ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/dashboard`
      : "http://localhost:3000/dashboard");

  try {
    const res = await apiFetch<{ url?: string; redirect?: boolean }>(
      "/api/auth/link-social",
      {
        method: "POST",
        body: JSON.stringify({
          provider: "github",
          callbackURL: redirectTarget,
        }),
      }
    );

    if (res?.url && typeof window !== "undefined") {
      window.location.href = res.url;
    }
    return res;
  } catch {
    return signInWithGitHub(redirectTarget);
  }
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

// ─── Ops Services & Deploys ──────────────────────────────────────────

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

export async function testServiceLogs(payload: {
  name?: string;
  platform: DeploymentPlatform;
  integrationId?: string | null;
  logUrl?: string;
  platformConfig?: Record<string, unknown>;
}) {
  return apiFetch<{
    ok: boolean;
    provider: string;
    message: string;
    authError?: boolean;
    sampleCount?: number;
    latencyMs?: number;
  }>("/api/ops/services/test-logs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchServiceLogs(params: {
  service: string;
  live?: boolean;
  lines?: number;
  startTime?: string;
  endTime?: string;
  level?: "debug" | "info" | "warn" | "error" | "fatal";
  keyword?: string;
  limit?: number;
}): Promise<ServiceLogEntry[]> {
  const sp = new URLSearchParams();
  sp.set("service", params.service);
  if (params.live) sp.set("live", "true");
  if (params.lines) sp.set("lines", String(params.lines));
  if (params.startTime) sp.set("startTime", params.startTime);
  if (params.endTime) sp.set("endTime", params.endTime);
  if (params.level) sp.set("level", params.level);
  if (params.keyword) sp.set("keyword", params.keyword);
  if (params.limit) sp.set("limit", String(params.limit));

  const res = await apiFetch<{ logs: ServiceLogEntry[] }>(
    `/api/ops/logs?${sp.toString()}`
  );
  return res.logs ?? [];
}

// ─── Cloud Integrations ──────────────────────────────────────────────

export async function listIntegrations(provider?: IntegrationProvider) {
  const q = provider ? `?provider=${encodeURIComponent(provider)}` : "";
  return apiFetch<{
    integrations: OrgIntegrationRow[];
    vigilServiceAccountEmail: string;
    vigilAwsAccountId: string;
  }>(`/api/ops/integrations${q}`);
}

export async function createIntegration(payload: {
  provider: IntegrationProvider;
  name: string;
  authMethod: IntegrationAuthMethod;
  publicConfig?: Record<string, unknown>;
  secret?: string;
}) {
  return apiFetch<{
    integration: OrgIntegrationRow;
    testResult?: { ok: boolean; message: string } | null;
    oneTimeIngestToken?: string;
  }>("/api/ops/integrations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function testIntegration(id: string) {
  return apiFetch<{
    result: { ok: boolean; message: string; latencyMs?: number };
    integration: OrgIntegrationRow | null;
  }>(`/api/ops/integrations/${id}/test`, {
    method: "POST",
  });
}

export async function deleteIntegration(id: string) {
  return apiFetch<{ deleted: boolean; id: string }>(
    `/api/ops/integrations/${id}`,
    { method: "DELETE" }
  );
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
  }>(`/api/ops/deploys${q}`);
}

// ─── Incidents & Failure Evaluations ─────────────────────────────────

export async function listIncidents(): Promise<IncidentRow[]> {
  const res = await apiFetch<{ incidents: IncidentRow[] }>("/api/incidents");
  return res.incidents ?? [];
}

export async function createIncident(params: {
  title: string;
  severity?: Severity;
  service?: string;
  symptomSummary?: string;
  conversationId?: string;
}) {
  return apiFetch<{
    incident: IncidentRow;
    conversationId: string;
    title: string;
    threadId: string;
    hypotheses: Hypothesis[];
    suggestedFixes: SuggestedFix[];
    answer: string;
    citations: Citation[];
    confidence: "high" | "medium" | "low";
    timeline: string[];
  }>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ─── Conversations & Chat History ────────────────────────────────────

export async function listChats(): Promise<ConversationRow[]> {
  const res = await apiFetch<{ conversations: ConversationRow[] }>("/api/chats");
  return res.conversations ?? [];
}

export async function createChat(params?: {
  mode?: "incident";
  title?: string;
}): Promise<ConversationRow> {
  const res = await apiFetch<{ conversation: ConversationRow }>("/api/chats", {
    method: "POST",
    body: JSON.stringify(params ?? {}),
  });
  return res.conversation;
}

export async function getChat(conversationId: string): Promise<{
  conversation: ConversationRow;
  messages: ConversationMessageRow[];
}> {
  return apiFetch<{
    conversation: ConversationRow;
    messages: ConversationMessageRow[];
  }>(`/api/chats/${conversationId}`);
}

export async function renameChat(
  conversationId: string,
  title: string
): Promise<ConversationRow> {
  const res = await apiFetch<{ conversation: ConversationRow }>(
    `/api/chats/${conversationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }
  );
  return res.conversation;
}

export async function deleteChat(conversationId: string) {
  return apiFetch<{ deleted: boolean; id: string }>(
    `/api/chats/${conversationId}`,
    { method: "DELETE" }
  );
}

export async function clearChats() {
  return apiFetch<{ cleared: boolean }>("/api/chats", { method: "DELETE" });
}

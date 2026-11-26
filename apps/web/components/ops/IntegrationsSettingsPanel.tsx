"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  API_BASE,
  createIntegration,
  deleteIntegration,
  listIntegrations,
  testIntegration,
} from "@/lib/api";
import type {
  IntegrationAuthMethod,
  IntegrationProvider,
  OrgIntegrationRow,
} from "@/types/vigil";

const PROVIDERS: {
  id: IntegrationProvider;
  label: string;
  subtitle: string;
  defaultAuth: IntegrationAuthMethod;
}[] = [
  {
    id: "gcp",
    label: "Google Cloud",
    subtitle: "Cloud Run & Compute Engine VMs",
    defaultAuth: "iam_delegation",
  },
  {
    id: "aws",
    label: "AWS",
    subtitle: "Lambda & EC2 CloudWatch Logs",
    defaultAuth: "sts_assume_role",
  },
  {
    id: "render",
    label: "Render",
    subtitle: "Render Services REST Logs",
    defaultAuth: "api_key",
  },
  {
    id: "vercel",
    label: "Vercel",
    subtitle: "Deployment & Runtime Logs",
    defaultAuth: "api_key",
  },
  {
    id: "vps",
    label: "Linux VPS",
    subtitle: "Push ingest token (Fluent Bit / Vector / curl)",
    defaultAuth: "ingest_token",
  },
];

export function IntegrationsSettingsPanel({
  onNotice,
}: {
  onNotice: (msg: string) => void;
}) {
  const [integrations, setIntegrations] = useState<OrgIntegrationRow[]>([]);
  const [vigilSaEmail, setVigilSaEmail] = useState(
    "vigil-logs-reader@vigil-ops.iam.gserviceaccount.com"
  );
  const [vigilAwsAccountId, setVigilAwsAccountId] = useState("123456789012");
  const [loading, setLoading] = useState(true);

  const [provider, setProvider] = useState<IntegrationProvider>("gcp");
  const [authMethod, setAuthMethod] =
    useState<IntegrationAuthMethod>("iam_delegation");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [region, setRegion] = useState("us-central1");
  const [roleArn, setRoleArn] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [secret, setSecret] = useState("");

  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [newIngestToken, setNewIngestToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadIntegrations = async () => {
    try {
      const data = await listIntegrations();
      setIntegrations(data.integrations ?? []);
      if (data.vigilServiceAccountEmail) {
        setVigilSaEmail(data.vigilServiceAccountEmail);
      }
      if (data.vigilAwsAccountId) {
        setVigilAwsAccountId(data.vigilAwsAccountId);
      }
    } catch {
      // Offline or unauthenticated
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    listIntegrations()
      .then((data) => {
        if (!active) return;
        setIntegrations(data.integrations ?? []);
        if (data.vigilServiceAccountEmail) {
          setVigilSaEmail(data.vigilServiceAccountEmail);
        }
        if (data.vigilAwsAccountId) {
          setVigilAwsAccountId(data.vigilAwsAccountId);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectProvider = (next: IntegrationProvider) => {
    setProvider(next);
    const meta = PROVIDERS.find((p) => p.id === next)!;
    setAuthMethod(meta.defaultAuth);
    setSecret("");
    setErrorMsg(null);
    if (next === "aws") setRegion("us-east-1");
    if (next === "gcp") setRegion("us-central1");
  };

  const copyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  const gcloudCommand = `gcloud projects add-iam-policy-binding ${
    projectId.trim() || "<YOUR_PROJECT_ID>"
  } --member="serviceAccount:${vigilSaEmail}" --role="roles/logging.viewer"`;

  const awsTrustPolicy = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: `arn:aws:iam::${vigilAwsAccountId}:root` },
          Action: "sts:AssumeRole",
          Condition: {
            StringEquals: { "sts:ExternalId": "<GENERATED_EXTERNAL_ID>" },
          },
        },
      ],
    },
    null,
    2
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    setNewIngestToken(null);

    const publicConfig: Record<string, unknown> = {};
    if (provider === "gcp") {
      if (projectId.trim()) publicConfig.projectId = projectId.trim();
      if (region.trim()) publicConfig.region = region.trim();
    } else if (provider === "aws") {
      if (region.trim()) publicConfig.region = region.trim();
      if (roleArn.trim()) publicConfig.roleArn = roleArn.trim();
    } else if (provider === "render") {
      if (ownerId.trim()) publicConfig.ownerId = ownerId.trim();
    } else if (provider === "vercel") {
      if (teamId.trim()) publicConfig.teamId = teamId.trim();
    }

    try {
      const res = await createIntegration({
        provider,
        name: name.trim(),
        authMethod,
        publicConfig,
        secret: secret.trim() || undefined,
      });

      setIntegrations((prev) => [res.integration, ...prev]);
      setName("");
      setSecret("");
      if (res.oneTimeIngestToken) {
        setNewIngestToken(res.oneTimeIngestToken);
        onNotice("VPS ingest token generated. Copy it now — it won't be shown again.");
      } else if (res.testResult?.ok) {
        onNotice(`Connected "${res.integration.name}" successfully.`);
      } else {
        onNotice(
          res.testResult?.message ||
            `Saved "${res.integration.name}". Run Test after granting permissions.`
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to save integration."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setErrorMsg(null);
    try {
      const res = await testIntegration(id);
      if (res.integration) {
        setIntegrations((prev) =>
          prev.map((item) => (item.id === id ? res.integration! : item))
        );
      }
      onNotice(res.result.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setIntegrations((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteIntegration(id);
      onNotice("Integration revoked.");
    } catch {
      loadIntegrations();
    }
  };

  const labelClass = "mb-1.5 block text-[12px] font-medium text-[#b5b7be]";

  return (
    <div className="space-y-5">
      {/* Add Cloud Account Card */}
      <section className="dash-card p-6">
        <div className="flex items-center gap-2.5">
          <Cloud className="h-4 w-4 text-[#e56b4e]" aria-hidden="true" />
          <h3 className="text-[15px] font-semibold text-[#ececef]">
            Connect cloud provider
          </h3>
        </div>
        <p className="mt-1 text-[13px] text-[#8a8c95]">
          Credentials are isolated per organization in encrypted storage or zero-secret IAM delegation — never exposed to the browser or LLM prompts.
        </p>

        {/* Provider Selector */}
        <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.07] bg-[#141519] p-1 sm:grid-cols-5">
          {PROVIDERS.map((p) => {
            const active = provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProvider(p.id)}
                className={`cursor-pointer rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors ${
                  active
                    ? "bg-white/[0.11] text-[#f2f2f4]"
                    : "text-[#8e909a] hover:text-[#ececef]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="int-name" className={labelClass}>
                Connection name
              </label>
              <input
                id="int-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  provider === "gcp"
                    ? "GCP Production"
                    : provider === "aws"
                      ? "AWS Production"
                      : provider === "vps"
                        ? "Hetzner Prod VPS"
                        : `${provider.toUpperCase()} Production`
                }
                className="dash-input"
              />
            </div>

            {provider === "gcp" && (
              <div>
                <label htmlFor="int-gcp-auth" className={labelClass}>
                  Authentication method
                </label>
                <select
                  id="int-gcp-auth"
                  value={authMethod}
                  onChange={(e) =>
                    setAuthMethod(e.target.value as IntegrationAuthMethod)
                  }
                  className="dash-input"
                >
                  <option value="iam_delegation">
                    Cross-Project IAM (Recommended, zero secret)
                  </option>
                  <option value="service_account_json">
                    Service Account JSON (AES-256-GCM encrypted)
                  </option>
                </select>
              </div>
            )}

            {provider === "aws" && (
              <div>
                <label htmlFor="int-aws-auth" className={labelClass}>
                  Authentication method
                </label>
                <select
                  id="int-aws-auth"
                  value={authMethod}
                  onChange={(e) =>
                    setAuthMethod(e.target.value as IntegrationAuthMethod)
                  }
                  className="dash-input"
                >
                  <option value="sts_assume_role">
                    Cross-Account IAM Role (STS AssumeRole)
                  </option>
                  <option value="api_key">
                    IAM Access Key (AES-256-GCM encrypted)
                  </option>
                </select>
              </div>
            )}
          </div>

          {provider === "gcp" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="int-gcp-proj" className={labelClass}>
                    GCP Project ID
                  </label>
                  <input
                    id="int-gcp-proj"
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="my-gcp-project-id"
                    className="dash-input"
                  />
                </div>
                <div>
                  <label htmlFor="int-gcp-reg" className={labelClass}>
                    Default Region (optional)
                  </label>
                  <input
                    id="int-gcp-reg"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="us-central1"
                    className="dash-input"
                  />
                </div>
              </div>

              {authMethod === "iam_delegation" ? (
                <div className="rounded-xl border border-white/[0.07] bg-[#141519] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-[#c9cbd3]">
                      Grant read-only Cloud Logging access (1-line gcloud command)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText("gcloud", gcloudCommand)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-[#9b9da6] hover:bg-white/[0.06] hover:text-[#f2f2f4]"
                    >
                      {copiedCmd === "gcloud" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedCmd === "gcloud" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="dash-scroll mt-2 overflow-x-auto font-mono-only text-[11.5px] text-[#b8bac2]">
                    {gcloudCommand}
                  </pre>
                </div>
              ) : (
                <div>
                  <label htmlFor="int-gcp-sa" className={labelClass}>
                    Read-only Service Account JSON
                  </label>
                  <textarea
                    id="int-gcp-sa"
                    required
                    rows={4}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder='{"type":"service_account","project_id":"...","private_key":"..."}'
                    className="dash-input font-mono-only text-[12px]"
                  />
                </div>
              )}
            </>
          )}

          {provider === "aws" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="int-aws-reg" className={labelClass}>
                    AWS Region
                  </label>
                  <input
                    id="int-aws-reg"
                    required
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="dash-input"
                  />
                </div>
                {authMethod === "sts_assume_role" && (
                  <div>
                    <label htmlFor="int-aws-arn" className={labelClass}>
                      IAM Role ARN
                    </label>
                    <input
                      id="int-aws-arn"
                      required
                      value={roleArn}
                      onChange={(e) => setRoleArn(e.target.value)}
                      placeholder="arn:aws:iam::123456789012:role/VigilLogsReader"
                      className="dash-input"
                    />
                  </div>
                )}
              </div>

              {authMethod === "sts_assume_role" ? (
                <div className="rounded-xl border border-white/[0.07] bg-[#141519] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-[#c9cbd3]">
                      Trust policy (attach logs:FilterLogEvents &amp; logs:DescribeLogStreams)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText("aws-trust", awsTrustPolicy)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-[#9b9da6] hover:bg-white/[0.06] hover:text-[#f2f2f4]"
                    >
                      {copiedCmd === "aws-trust" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedCmd === "aws-trust" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="dash-scroll mt-2 overflow-x-auto font-mono-only text-[11px] text-[#b8bac2]">
                    {awsTrustPolicy}
                  </pre>
                </div>
              ) : (
                <div>
                  <label htmlFor="int-aws-key" className={labelClass}>
                    Access Key (ACCESS_KEY_ID:SECRET_ACCESS_KEY)
                  </label>
                  <input
                    id="int-aws-key"
                    type="password"
                    required
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="AKIA...:secretAccessKey"
                    className="dash-input font-mono-only"
                  />
                </div>
              )}
            </>
          )}

          {provider === "render" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="int-render-key" className={labelClass}>
                  Render API Key
                </label>
                <input
                  id="int-render-key"
                  type="password"
                  required
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="rnd_..."
                  className="dash-input font-mono-only"
                />
              </div>
              <div>
                <label htmlFor="int-render-owner" className={labelClass}>
                  Owner ID (optional)
                </label>
                <input
                  id="int-render-owner"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  placeholder="tea-..."
                  className="dash-input font-mono-only"
                />
              </div>
            </div>
          )}

          {provider === "vercel" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="int-vercel-tok" className={labelClass}>
                  Vercel Bearer Token
                </label>
                <input
                  id="int-vercel-tok"
                  type="password"
                  required
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="vercel_..."
                  className="dash-input font-mono-only"
                />
              </div>
              <div>
                <label htmlFor="int-vercel-team" className={labelClass}>
                  Team ID (optional)
                </label>
                <input
                  id="int-vercel-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="team_..."
                  className="dash-input font-mono-only"
                />
              </div>
            </div>
          )}

          {provider === "vps" && (
            <p className="rounded-xl border border-white/[0.07] bg-[#141519] px-3.5 py-2.5 text-[12.5px] text-[#9b9da6]">
              Vigil will generate a one-time <code className="font-mono-only text-[#ececef]">X-Vigil-Ingest-Key</code> (stored as a SHA-256 hash) for shipping logs from Fluent Bit, Vector, or journald to <code className="font-mono-only text-[#ececef]">POST /api/ingest/logs</code>.
            </p>
          )}

          {errorMsg && (
            <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-300">
              {errorMsg}
            </p>
          )}

          {newIngestToken && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-300">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  One-time VPS Ingest Token (save now)
                </span>
                <button
                  type="button"
                  onClick={() => copyText("ingest-tok", newIngestToken)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11.5px] text-white hover:bg-white/15"
                >
                  {copiedCmd === "ingest-tok" ? (
                    <Check className="h-3 w-3 text-emerald-300" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedCmd === "ingest-tok" ? "Copied" : "Copy token"}</span>
                </button>
              </div>
              <pre className="dash-scroll overflow-x-auto rounded-lg bg-black/30 p-2.5 font-mono-only text-[11.5px] text-emerald-200">
                {`curl -X POST ${API_BASE}/api/ingest/logs \\
  -H "Content-Type: application/json" \\
  -H "X-Vigil-Ingest-Key: ${newIngestToken}" \\
  -d '{"service":"my-vps-app","logs":[{"level":"error","message":"Database timeout"}]}'`}
              </pre>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="dash-btn-primary"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {provider === "vps"
                  ? "Generate ingest token"
                  : "Save & verify"}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* Connected Integrations List */}
      <section className="dash-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#ececef]">
              Connected cloud accounts ({integrations.length})
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[#8a8c95]">
              Secrets are write-only and never returned by the API.
            </p>
          </div>
          <button
            type="button"
            onClick={loadIntegrations}
            className="dash-btn-ghost !py-1.5 !text-[12px]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-[13px] text-[#7f828d]">
            Loading integrations…
          </div>
        ) : integrations.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] text-[#7f828d]">
            No cloud providers connected yet. Add one above to enable multi-tenant live logs.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {integrations.map((item) => {
              const cfgSummary = Object.entries(item.publicConfig ?? {})
                .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
                .slice(0, 3)
                .map(([k, v]) => `${k}=${String(v)}`)
                .join(" · ");

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-[#f2f2f4]">
                        {item.name}
                      </span>
                      <span className="font-mono-only rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] uppercase text-[#b8bac2]">
                        {item.provider}
                      </span>
                      <span className="font-mono-only text-[11px] text-[#7f828d]">
                        {item.authMethod}
                      </span>
                      {item.status === "connected" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Connected
                        </span>
                      ) : item.status === "error" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                          Error
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                          Pending
                        </span>
                      )}
                    </div>
                    {cfgSummary && (
                      <div className="mt-1 truncate font-mono-only text-[11.5px] text-[#848791]">
                        {cfgSummary}
                      </div>
                    )}
                    {item.lastError && (
                      <div className="mt-1 text-[12px] text-rose-300/90">
                        {item.lastError}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={testingId === item.id}
                      onClick={() => handleTest(item.id)}
                      className="dash-btn-ghost !py-1.5 !text-[12px]"
                    >
                      {testingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span>Test</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      aria-label={`Revoke ${item.name}`}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#7f828d] transition-colors hover:bg-rose-500/12 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

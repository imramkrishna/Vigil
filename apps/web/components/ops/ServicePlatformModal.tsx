"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2, ChevronRight } from "lucide-react";
import { listIntegrations, testServiceLogs } from "@/lib/api";
import type {
  DeploymentPlatform,
  IntegrationProvider,
  OrgIntegrationRow,
  ServiceRegistrationPayload,
} from "../../types/vigil";

interface ServicePlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterService: (
    service: ServiceRegistrationPayload
  ) => Promise<boolean> | void;
  initialService?: Partial<ServiceRegistrationPayload>;
}

const PLATFORMS: {
  id: DeploymentPlatform;
  label: string;
  provider: IntegrationProvider | null;
}[] = [
  { id: "cloud_run", label: "Cloud Run", provider: "gcp" },
  { id: "gcp_vm", label: "GCP VM", provider: "gcp" },
  { id: "aws_lambda", label: "Lambda", provider: "aws" },
  { id: "aws_ec2", label: "EC2", provider: "aws" },
  { id: "render", label: "Render", provider: "render" },
  { id: "vercel", label: "Vercel", provider: "vercel" },
  { id: "vps", label: "Linux VPS", provider: "vps" },
  { id: "custom", label: "Custom", provider: null },
];

const PLATFORM_FIELDS: Record<DeploymentPlatform, [string, string, string][]> = {
  cloud_run: [
    ["projectId", "Project ID", "my-gcp-production"],
    ["serviceName", "Service", "checkout-api"],
    ["region", "Region", "us-central1"],
  ],
  gcp_vm: [
    ["projectId", "Project ID", "my-gcp-production"],
    ["instanceName", "Instance name", "api-vm-01"],
    ["zone", "Zone", "us-central1-a"],
  ],
  aws_lambda: [
    ["region", "Region", "us-east-1"],
    ["functionName", "Function", "checkout-authorizer"],
    ["logGroupName", "Log group", "/aws/lambda/checkout"],
  ],
  aws_ec2: [
    ["region", "Region", "us-east-1"],
    ["logGroupName", "Log group", "/var/log/app"],
    ["instanceId", "Instance ID", "i-0982348af"],
  ],
  render: [
    ["serviceId", "Service ID", "srv-cbq384234"],
    ["ownerId", "Owner ID (opt)", "tea-12345"],
  ],
  vercel: [
    ["projectId", "Project ID", "prj_898492"],
    ["teamId", "Team ID (opt)", "team_abc123"],
    ["deploymentId", "Deployment (opt)", "dpl_892348"],
  ],
  vps: [
    ["hostname", "Hostname", "prod-eu-01.example.com"],
    ["unitName", "Systemd / container unit", "checkout-api.service"],
  ],
  custom: [
    ["logUrl", "Custom Logs URL (HTTPS)", "https://logs.example.com/api/logs"],
  ],
};

export const ServicePlatformModal: React.FC<ServicePlatformModalProps> = ({
  isOpen,
  onClose,
  onRegisterService,
  initialService,
}) => {
  const [name, setName] = useState(initialService?.name || "");
  const [tier, setTier] = useState<1 | 2 | 3>(initialService?.tier || 1);
  const [owner, setOwner] = useState(initialService?.owner || "");
  const [slackChannel, setSlackChannel] = useState(
    initialService?.slackChannel || ""
  );
  const [repoUrl, setRepoUrl] = useState(initialService?.repoUrl || "");
  const [githubBranch, setGithubBranch] = useState(
    initialService?.githubBranch || "main"
  );
  const [platform, setPlatform] = useState<DeploymentPlatform>(
    initialService?.platform || "cloud_run"
  );
  const [integrationId, setIntegrationId] = useState<string>(
    initialService?.integrationId || ""
  );
  const [integrations, setIntegrations] = useState<OrgIntegrationRow[]>([]);

  const [platformConfig, setPlatformConfig] = useState<Record<string, string>>({
    projectId: "",
    serviceName: "",
    region: "",
    instanceName: "",
    zone: "",
    functionName: "",
    logGroupName: "",
    instanceId: "",
    serviceId: "",
    ownerId: "",
    teamId: "",
    deploymentId: "",
    hostname: "",
    unitName: "",
    logUrl: initialService?.logUrl || "",
    ...initialService?.platformConfig,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    listIntegrations()
      .then((res) => setIntegrations(res.integrations ?? []))
      .catch(() => {});

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const currentProvider =
    PLATFORMS.find((p) => p.id === platform)?.provider ?? null;

  const matchingIntegrations = useMemo(
    () =>
      currentProvider
        ? integrations.filter((i) => i.provider === currentProvider)
        : [],
    [integrations, currentProvider]
  );

  if (!isOpen) return null;

  const handleConfigChange = (key: string, value: string) => {
    setPlatformConfig((prev) => ({ ...prev, [key]: value }));
  };

  const buildPlatformPayload = () => {
    const fields = PLATFORM_FIELDS[platform];
    const clean: Record<string, string> = { platform };
    for (const [key] of fields) {
      const val = (platformConfig[key] || "").trim();
      if (val) clean[key] = val;
    }
    return clean;
  };

  const handleTestConnection = async () => {
    if (!name.trim()) {
      setTestResult({ success: false, message: "Service name is required." });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testServiceLogs({
        name: name.trim(),
        platform,
        integrationId: integrationId || null,
        logUrl: platform === "custom" ? platformConfig.logUrl?.trim() : undefined,
        platformConfig: buildPlatformPayload(),
      });
      setTestResult({
        success: Boolean(res.ok),
        message: res.message || (res.ok ? "Connected." : "Connection failed."),
      });
    } catch (err) {
      setTestResult({
        success: false,
        message:
          err instanceof Error ? err.message : "Connectivity check failed.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const cleanConfig = buildPlatformPayload();
      await onRegisterService({
        name: name.trim(),
        integrationId: integrationId || null,
        tier,
        owner,
        slackChannel,
        repoUrl,
        githubBranch,
        platform,
        logUrl: platform === "custom" ? (cleanConfig.logUrl ?? "") : "",
        platformConfig: cleanConfig,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const repoMatch = repoUrl.match(
    /github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/
  );
  const canSubmit = name.trim().length > 0 && !isSaving;

  const onRepoChange = (v: string) => {
    setRepoUrl(v);
    const m = v.match(/github\.com\/[\w.-]+\/([\w.-]+?)(?:\.git)?\/?$/);
    if (m && !name.trim()) setName(m[1]);
  };

  const labelClass = "mb-1.5 block text-[12px] font-medium text-[#94969e]";

  return (
    <div
      className="dash-fade fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-service-title"
        className="dash-pop flex max-h-[90vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1d1f24] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h3
              id="add-service-title"
              className="text-[15.5px] font-semibold text-[#ececef]"
            >
              Add service
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[#8a8c95]">
              Link a service to a cloud connection for live &amp; historical logs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="-mr-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#8a8c95] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="dash-scroll flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="svc-name" className={labelClass}>
                Name
              </label>
              <input
                id="svc-name"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="checkout-api"
                className="dash-input"
              />
            </div>
            <div>
              <label htmlFor="svc-tier" className={labelClass}>
                Tier
              </label>
              <select
                id="svc-tier"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value) as 1 | 2 | 3)}
                className="dash-input"
              >
                <option value={1}>Tier 1</option>
                <option value={2}>Tier 2</option>
                <option value={3}>Tier 3</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label
                htmlFor="svc-repo"
                className={`${labelClass} flex items-center justify-between`}
              >
                <span>Repository</span>
                {repoMatch && (
                  <span className="font-mono-only text-[11px] font-normal text-emerald-400">
                    {repoMatch[1]}
                  </span>
                )}
              </label>
              <input
                id="svc-repo"
                value={repoUrl}
                onChange={(e) => onRepoChange(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="dash-input"
              />
            </div>
            <div>
              <label htmlFor="svc-branch" className={labelClass}>
                Branch
              </label>
              <input
                id="svc-branch"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                placeholder="main"
                className="dash-input"
              />
            </div>
          </div>

          <div>
            <span className={labelClass}>Platform</span>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.07] bg-[#141519] p-1">
              {PLATFORMS.map((p) => {
                const active = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPlatform(p.id);
                      setIntegrationId("");
                      setTestResult(null);
                    }}
                    className={`cursor-pointer rounded-lg py-1.5 text-[12px] font-medium transition-colors ${
                      active
                        ? "bg-white/[0.11] text-[#ececef]"
                        : "text-[#8a8c95] hover:text-[#d8dae0]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cloud Integration Picker */}
          {currentProvider && (
            <div>
              <label htmlFor="svc-integration" className={labelClass}>
                Cloud connection ({currentProvider.toUpperCase()})
              </label>
              <select
                id="svc-integration"
                value={integrationId}
                onChange={(e) => setIntegrationId(e.target.value)}
                className="dash-input"
              >
                <option value="">
                  {matchingIntegrations.length > 0
                    ? "Auto-select default org integration"
                    : "No integration connected yet (configure in Settings → Integrations)"}
                </option>
                {matchingIntegrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.authMethod} · {i.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            key={platform}
            className={`dash-fade grid gap-3 ${
              PLATFORM_FIELDS[platform].length === 1
                ? "grid-cols-1"
                : PLATFORM_FIELDS[platform].length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-3"
            }`}
          >
            {PLATFORM_FIELDS[platform].map(([key, text, ph]) => (
              <div key={key}>
                <label htmlFor={`svc-cfg-${key}`} className={labelClass}>
                  {text}
                </label>
                <input
                  id={`svc-cfg-${key}`}
                  value={platformConfig[key] || ""}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  placeholder={ph}
                  className="dash-input"
                />
              </div>
            ))}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[#8a8c95] transition-colors hover:text-[#ececef]"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${
                  showMore ? "rotate-90" : ""
                }`}
                aria-hidden="true"
              />
              <span>Owner &amp; Slack channel</span>
            </button>

            {showMore && (
              <div className="dash-rise mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="svc-owner" className={labelClass}>
                    Owner
                  </label>
                  <input
                    id="svc-owner"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="payments-core"
                    className="dash-input"
                  />
                </div>
                <div>
                  <label htmlFor="svc-slack" className={labelClass}>
                    Slack channel
                  </label>
                  <input
                    id="svc-slack"
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    placeholder="#incidents"
                    className="dash-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestConnection}
              className="dash-btn-ghost shrink-0"
            >
              {isTesting && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              <span>{isTesting ? "Testing…" : "Test connection"}</span>
            </button>
            {testResult && (
              <span
                className={`truncate text-[12px] ${
                  testResult.success ? "text-emerald-400" : "text-rose-400"
                }`}
                title={testResult.message}
              >
                {testResult.message}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="dash-btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="dash-btn-primary"
            >
              {isSaving && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              <span>Add service</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

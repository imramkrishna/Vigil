"use client";

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { DeploymentPlatform, ServiceRegistrationPayload } from '../../types/vigil';

interface ServicePlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterService: (service: ServiceRegistrationPayload) => Promise<boolean> | void;
  initialService?: Partial<ServiceRegistrationPayload>;
}

export const ServicePlatformModal: React.FC<ServicePlatformModalProps> = ({
  isOpen,
  onClose,
  onRegisterService,
  initialService,
}) => {
  const [name, setName] = useState(initialService?.name || '');
  const [tier, setTier] = useState<1 | 2 | 3>(initialService?.tier || 1);
  const [owner, setOwner] = useState(initialService?.owner || '');
  const [slackChannel, setSlackChannel] = useState(initialService?.slackChannel || '');
  const [repoUrl, setRepoUrl] = useState(initialService?.repoUrl || '');
  const [githubBranch, setGithubBranch] = useState(initialService?.githubBranch || 'main');
  const [platform, setPlatform] = useState<DeploymentPlatform>(initialService?.platform || 'cloud_run');
  const [logUrl, setLogUrl] = useState(
    initialService?.logUrl || ''
  );

  // Dynamic platform configs
  const [platformConfig, setPlatformConfig] = useState<Record<string, string>>({
    projectId: '',
    serviceName: '',
    region: '',
    functionName: '',
    logGroupName: '',
    instanceId: '',
    serviceId: '',
    deploymentId: '',
    apiKeyEnv: '',
    logPath: '',
    teamSlug: '',
    authHeaderName: '',
    healthCheckUrl: '',
    ...initialService?.platformConfig,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  if (!isOpen) return null;

  const PLATFORMS: { id: DeploymentPlatform; label: string }[] = [
    { id: 'cloud_run', label: 'Cloud Run' },
    { id: 'aws_lambda', label: 'Lambda' },
    { id: 'aws_ec2', label: 'EC2' },
    { id: 'render', label: 'Render' },
    { id: 'vercel', label: 'Vercel' },
    { id: 'custom', label: 'Custom' },
  ];

  const PLATFORM_FIELDS: Record<DeploymentPlatform, [string, string, string][]> = {
    cloud_run: [['projectId', 'Project ID', 'acme-production'], ['serviceName', 'Service', 'checkout-api'], ['region', 'Region', 'us-central1']],
    aws_lambda: [['region', 'Region', 'us-east-1'], ['functionName', 'Function', 'checkout-authorizer'], ['logGroupName', 'Log group', '/aws/lambda/checkout']],
    aws_ec2: [['region', 'Region', 'us-east-1'], ['instanceId', 'Instance ID', 'i-0982348af'], ['logPath', 'Log path', '/var/log/app/error.log']],
    render: [['serviceId', 'Service ID', 'srv-cbq384234'], ['apiKeyEnv', 'API key secret', 'RENDER_API_KEY']],
    vercel: [['projectId', 'Project ID', 'prj_898492'], ['teamSlug', 'Team', 'my-team'], ['deploymentId', 'Deployment', 'dpl_892348']],
    custom: [['authHeaderName', 'Auth header', 'X-Ops-Token'], ['healthCheckUrl', 'Health check URL', 'https://service/healthz']],
  };

  const handleConfigChange = (key: string, value: string) => {
    setPlatformConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 900));
    setIsTesting(false);
    setTestResult(
      !name.trim() || !logUrl.trim()
        ? { success: false, message: 'Service name and log URL are required.' }
        : { success: true, message: 'Connection successful.' }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onRegisterService({ name, tier, owner, slackChannel, repoUrl, githubBranch, platform, logUrl, platformConfig });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const label = 'mb-1.5 block text-[12px] text-zinc-400';
  const input =
    'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-white/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0e11] shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h3 className="text-[16px] font-semibold text-white">Add service</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={label}>Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="checkout-api" className={input} />
            </div>
            <div>
              <label className={label}>Tier</label>
              <select value={tier} onChange={(e) => setTier(Number(e.target.value) as 1 | 2 | 3)} className={input}>
                <option value={1}>Tier 1</option>
                <option value={2}>Tier 2</option>
                <option value={3}>Tier 3</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={label}>Repository</label>
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" className={input} />
            </div>
            <div>
              <label className={label}>Branch</label>
              <input value={githubBranch} onChange={(e) => setGithubBranch(e.target.value)} placeholder="main" className={input} />
            </div>
          </div>

          <div>
            <label className={label}>Platform</label>
            <div className="grid grid-cols-6 gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`rounded-md py-1.5 text-[12px] transition-colors ${
                    platform === p.id ? 'bg-white/[0.1] font-medium text-white' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>Log endpoint</label>
            <input value={logUrl} onChange={(e) => setLogUrl(e.target.value)} placeholder="https://logging.googleapis.com/…" className={input} />
          </div>

          <div className={`grid gap-3 ${PLATFORM_FIELDS[platform].length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {PLATFORM_FIELDS[platform].map(([key, text, ph]) => (
              <div key={key}>
                <label className={label}>{text}</label>
                <input
                  value={platformConfig[key] || ''}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  placeholder={ph}
                  className={input}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {showMore ? 'Hide' : 'Show'} owner & Slack channel
          </button>
          {showMore && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Owner</label>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="payments-core" className={input} />
              </div>
              <div>
                <label className={label}>Slack channel</label>
                <input value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} placeholder="#incidents" className={input} />
              </div>
            </div>
          )}

          {testResult && (
            <p className={`text-[12.5px] ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
              {testResult.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestConnection}
            className="flex items-center gap-2 text-[13px] text-zinc-400 transition-colors hover:text-white"
          >
            {isTesting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isTesting ? 'Testing…' : 'Test connection'}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="dash-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="dash-btn-primary">
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add service
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

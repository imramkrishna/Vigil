import type { Request, Response } from "express";
import {
  assertSafeExternalUrl,
  createOrgIntegration,
  deleteOrgIntegration,
  DEPLOYMENT_PLATFORMS,
  fetchGitHubDeploysForOrg,
  getLiveLogs,
  getLogsByTimestamp,
  getMonthlyBudgetStatus,
  getPastIncidents,
  getRecentDeploys,
  INTEGRATION_AUTH_METHODS,
  INTEGRATION_PROVIDERS,
  listOpsServices,
  listOrgIntegrations,
  SsrfBlockedError,
  testIntegrationConnection,
  testServiceLogsConnection,
  upsertOpsService,
  type DeploymentPlatform,
  type IntegrationAuthMethod,
  type IntegrationProvider,
  type LogLevel,
  type PlatformConfig,
} from "@vigil/core";

// GET /api/ops/services — List all registered services for the active org
export async function listServicesController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const services = await listOpsServices(orgId);
    res.json({ services });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch services";
    res.status(500).json({ error: message });
  }
}

// POST /api/ops/services — Create or update a service (including integrationId, platform, logUrl, repoUrl)
export async function upsertServiceController(req: Request, res: Response) {
  try {
    const {
      name,
      integrationId,
      tier,
      owner,
      slackChannel,
      repoUrl,
      githubBranch,
      platform,
      logUrl,
      platformConfig,
    } = req.body as {
      name?: string;
      integrationId?: string | null;
      tier?: number;
      owner?: string;
      slackChannel?: string;
      repoUrl?: string;
      githubBranch?: string;
      platform?: DeploymentPlatform;
      logUrl?: string;
      platformConfig?: PlatformConfig;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Service name is required." });
      return;
    }

    if (platform && !DEPLOYMENT_PLATFORMS.includes(platform)) {
      res.status(400).json({
        error: `Unsupported platform. Choose one of: ${DEPLOYMENT_PLATFORMS.join(", ")}`,
      });
      return;
    }

    const candidateLogUrl =
      logUrl?.trim() ||
      (platformConfig as { logUrl?: string } | undefined)?.logUrl?.trim();
    if (candidateLogUrl) {
      try {
        await assertSafeExternalUrl(candidateLogUrl);
      } catch (err) {
        res.status(400).json({
          error:
            err instanceof Error
              ? err.message
              : "Invalid or blocked custom logUrl.",
        });
        return;
      }
    }

    const { orgId } = req.auth!;
    const service = await upsertOpsService({
      orgId,
      integrationId: integrationId || null,
      name,
      tier,
      owner,
      slackChannel,
      repoUrl,
      githubBranch,
      platform,
      logUrl: candidateLogUrl || undefined,
      platformConfig,
    });

    res.status(201).json({ service });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save service";
    res.status(500).json({ error: message });
  }
}

// POST /api/ops/services/test-logs — Real connectivity check for Add Service modal
export async function testServiceLogsController(req: Request, res: Response) {
  try {
    const { name, platform, integrationId, logUrl, platformConfig } =
      req.body as {
        name?: string;
        platform?: DeploymentPlatform;
        integrationId?: string | null;
        logUrl?: string;
        platformConfig?: PlatformConfig | Record<string, unknown>;
      };

    if (!platform || !DEPLOYMENT_PLATFORMS.includes(platform)) {
      res.status(400).json({
        error: `Valid platform is required (${DEPLOYMENT_PLATFORMS.join(", ")}).`,
      });
      return;
    }

    const candidateLogUrl =
      logUrl?.trim() ||
      (platformConfig as { logUrl?: string } | undefined)?.logUrl?.trim();
    if (candidateLogUrl) {
      try {
        await assertSafeExternalUrl(candidateLogUrl);
      } catch (err) {
        res.status(400).json({
          ok: false,
          error:
            err instanceof Error ? err.message : "Blocked or invalid logUrl.",
        });
        return;
      }
    }

    const { orgId } = req.auth!;
    const result = await testServiceLogsConnection(orgId, {
      name,
      platform,
      integrationId: integrationId || null,
      logUrl: candidateLogUrl || undefined,
      platformConfig,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      res.status(400).json({ ok: false, error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : "Connectivity check failed";
    res.status(500).json({ ok: false, error: message });
  }
}

// GET /api/ops/logs — Unified live tail & timestamp-range logs query
export async function getLogsController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const service = String(req.query.service ?? "").trim();
    const live = req.query.live === "true" || req.query.live === "1";
    const startTime = req.query.startTime as string | undefined;
    const endTime = req.query.endTime as string | undefined;
    const level = req.query.level as LogLevel | undefined;
    const keyword = req.query.keyword as string | undefined;
    const lines = req.query.lines ? Number(req.query.lines) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    if (!service) {
      res.status(400).json({ error: "Query parameter 'service' is required." });
      return;
    }

    const logs = live || !startTime
      ? await getLiveLogs({
          orgId,
          service,
          level,
          lines: lines ?? limit ?? 30,
        })
      : await getLogsByTimestamp({
          orgId,
          service,
          startTime,
          endTime,
          level,
          keyword,
          limit: limit ?? lines ?? 50,
        });

    res.json({ logs });
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : "Failed to fetch logs";
    res.status(500).json({ error: message });
  }
}

// GET /api/ops/integrations — List org cloud integrations (masked metadata only, never secrets)
export async function listIntegrationsController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const providerParam = req.query.provider as IntegrationProvider | undefined;
    if (providerParam && !INTEGRATION_PROVIDERS.includes(providerParam)) {
      res.status(400).json({ error: "Unsupported provider filter." });
      return;
    }
    const integrations = await listOrgIntegrations(orgId, providerParam);
    res.json({
      integrations,
      vigilServiceAccountEmail:
        process.env.VIGIL_GCP_SERVICE_ACCOUNT_EMAIL ||
        "vigil-logs-reader@vigil-ops.iam.gserviceaccount.com",
      vigilAwsAccountId: process.env.VIGIL_AWS_ACCOUNT_ID || "123456789012",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch integrations";
    res.status(500).json({ error: message });
  }
}

// POST /api/ops/integrations — Create a cloud integration (admin/lead only)
export async function createIntegrationController(req: Request, res: Response) {
  try {
    const { orgId, userId } = req.auth!;
    const { provider, name, authMethod, publicConfig, secret } = req.body as {
      provider?: IntegrationProvider;
      name?: string;
      authMethod?: IntegrationAuthMethod;
      publicConfig?: Record<string, unknown>;
      secret?: string;
    };

    if (!provider || !INTEGRATION_PROVIDERS.includes(provider)) {
      res.status(400).json({
        error: `Valid provider is required (${INTEGRATION_PROVIDERS.join(", ")}).`,
      });
      return;
    }
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Integration name is required." });
      return;
    }
    if (!authMethod || !INTEGRATION_AUTH_METHODS.includes(authMethod)) {
      res.status(400).json({
        error: `Valid authMethod is required (${INTEGRATION_AUTH_METHODS.join(", ")}).`,
      });
      return;
    }

    const { integration, oneTimeIngestToken } = await createOrgIntegration({
      orgId,
      createdBy: userId,
      provider,
      name,
      authMethod,
      publicConfig,
      secret,
    });

    let testResult = null;
    if (authMethod !== "ingest_token") {
      testResult = await testIntegrationConnection(orgId, integration.id);
    }

    const refreshed = await listOrgIntegrations(orgId, provider);
    const finalIntegration =
      refreshed.find((r) => r.id === integration.id) ?? integration;

    res.status(201).json({
      integration: finalIntegration,
      testResult,
      ...(oneTimeIngestToken ? { oneTimeIngestToken } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create integration";
    const status = message.includes("CREDENTIALS_ENCRYPTION_KEY") ? 500 : 400;
    res.status(status).json({ error: message });
  }
}

// POST /api/ops/integrations/:id/test — Verify connectivity and update status
export async function testIntegrationController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "Integration ID is required." });
      return;
    }

    const result = await testIntegrationConnection(orgId, id);
    const list = await listOrgIntegrations(orgId);
    const integration = list.find((item) => item.id === id) ?? null;

    res.json({ result, integration });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test integration";
    res.status(500).json({ error: message });
  }
}

// DELETE /api/ops/integrations/:id — Revoke and delete an integration (admin/lead only)
export async function deleteIntegrationController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "Integration ID is required." });
      return;
    }

    const deleted = await deleteOrgIntegration(orgId, id);
    if (!deleted) {
      res.status(404).json({ error: "Integration not found." });
      return;
    }
    res.json({ deleted: true, id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete integration";
    res.status(500).json({ error: message });
  }
}

// GET /api/ops/deploys — List recent deploys & past incidents
export async function listDeploysController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const service = req.query.service as string | undefined;

    const [dbDeploys, ghDeploys, pastIncidents] = await Promise.all([
      getRecentDeploys(orgId, service, 15),
      fetchGitHubDeploysForOrg(orgId, service, 10),
      getPastIncidents(orgId, { service, limit: 10 }),
    ]);

    res.json({ deploys: [...ghDeploys, ...dbDeploys], pastIncidents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch deploys";
    res.status(500).json({ error: message });
  }
}

// GET /api/ops/budget — Get monthly LLM token spend & budget status
export async function getBudgetController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const budget = await getMonthlyBudgetStatus(orgId);
    res.json({ budget });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch budget status";
    res.status(500).json({ error: message });
  }
}

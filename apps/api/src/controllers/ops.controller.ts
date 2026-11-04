import type { Request, Response } from "express";
import {
  DEPLOYMENT_PLATFORMS,
  fetchGitHubDeploysForOrg,
  getMonthlyBudgetStatus,
  getPastIncidents,
  getRecentDeploys,
  listOpsServices,
  upsertOpsService,
  type DeploymentPlatform,
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

// POST /api/ops/services — Create or update a service (including platform, logUrl, repoUrl)
export async function upsertServiceController(req: Request, res: Response) {
  try {
    const {
      name,
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

    const { orgId } = req.auth!;
    const service = await upsertOpsService({
      orgId,
      name,
      tier,
      owner,
      slackChannel,
      repoUrl,
      githubBranch,
      platform,
      logUrl,
      platformConfig,
    });

    res.status(201).json({ service });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save service";
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

import type { Request, Response } from "express";
import { getOrgGitHubToken } from "@vigil/core";

// GET /api/me — Return authenticated user, active workspace (orgId), RBAC role, and GitHub connection status
export async function getMeController(req: Request, res: Response) {
  const auth = req.auth!;
  const githubToken = await getOrgGitHubToken(auth.orgId);

  res.json({
    user: {
      ...auth,
      githubConnected: Boolean(githubToken),
    },
  });
}

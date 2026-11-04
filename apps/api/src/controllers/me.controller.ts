import type { Request, Response } from "express";

// GET /api/me — Return authenticated user, active workspace (orgId), and RBAC role
export function getMeController(req: Request, res: Response) {
  res.json({ user: req.auth });
}

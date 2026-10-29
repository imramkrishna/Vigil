import { db, members, orgs, type Role } from "@vigil/core";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { auth } from "../auth";

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Verifies the Better Auth session cookie/bearer token, resolves the user's
 * active organization and RBAC role from `members`, and attaches `req.auth`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const requestedOrgId = req.header("x-org-id");

    const rows = await db
      .select({
        orgId: members.orgId,
        role: members.role,
        orgName: orgs.name,
      })
      .from(members)
      .innerJoin(orgs, eq(orgs.id, members.orgId))
      .where(
        requestedOrgId
          ? and(
              eq(members.userId, session.user.id),
              eq(members.orgId, requestedOrgId)
            )
          : eq(members.userId, session.user.id)
      )
      .limit(1);

    const membership = rows[0];
    if (!membership) {
      res.status(403).json({ error: "No workspace membership found" });
      return;
    }

    req.auth = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      orgId: membership.orgId,
      orgName: membership.orgName,
      role: membership.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restricts an endpoint to specific RBAC roles (e.g., responder, lead, admin).
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      res.status(403).json({
        error: `Forbidden: requires role ${allowed.join(" or ")}`,
      });
      return;
    }
    next();
  };
}

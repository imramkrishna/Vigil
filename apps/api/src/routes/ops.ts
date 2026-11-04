import { Router } from "express";
import {
  getBudgetController,
  listDeploysController,
  listServicesController,
  upsertServiceController,
} from "../controllers";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const opsRouter = Router();

opsRouter.get("/services", requireAuth, listServicesController);
opsRouter.post(
  "/services",
  requireAuth,
  requireRole("admin", "lead", "responder"),
  upsertServiceController
);
opsRouter.get("/deploys", requireAuth, listDeploysController);
opsRouter.get("/budget", requireAuth, getBudgetController);

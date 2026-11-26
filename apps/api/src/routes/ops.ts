import { Router } from "express";
import {
  createIntegrationController,
  deleteIntegrationController,
  getLogsController,
  listDeploysController,
  listIntegrationsController,
  listServicesController,
  testIntegrationController,
  testServiceLogsController,
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
opsRouter.post(
  "/services/test-logs",
  requireAuth,
  requireRole("admin", "lead", "responder"),
  testServiceLogsController
);

opsRouter.get("/logs", requireAuth, getLogsController);

opsRouter.get("/integrations", requireAuth, listIntegrationsController);
opsRouter.post(
  "/integrations",
  requireAuth,
  requireRole("admin", "lead"),
  createIntegrationController
);
opsRouter.post(
  "/integrations/:id/test",
  requireAuth,
  requireRole("admin", "lead", "responder"),
  testIntegrationController
);
opsRouter.delete(
  "/integrations/:id",
  requireAuth,
  requireRole("admin", "lead"),
  deleteIntegrationController
);

opsRouter.get("/deploys", requireAuth, listDeploysController);

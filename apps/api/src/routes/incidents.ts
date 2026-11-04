import { Router } from "express";
import {
  createIncidentController,
  generatePostmortemController,
  getIncidentByIdController,
  listIncidentsController,
} from "../controllers";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const incidentsRouter = Router();

incidentsRouter.get("/", requireAuth, listIncidentsController);
incidentsRouter.get("/:id", requireAuth, getIncidentByIdController);
incidentsRouter.post(
  "/",
  requireAuth,
  requireRole("admin", "lead", "responder"),
  createIncidentController
);
incidentsRouter.post(
  "/:id/postmortem",
  requireAuth,
  requireRole("admin", "lead", "responder"),
  generatePostmortemController
);

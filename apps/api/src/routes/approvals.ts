import { Router } from "express";
import {
  decideApprovalController,
  listApprovalsController,
} from "../controllers";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const approvalsRouter = Router();

approvalsRouter.get("/", requireAuth, listApprovalsController);
approvalsRouter.post(
  "/:id/decide",
  requireAuth,
  requireRole("admin", "lead"),
  decideApprovalController
);

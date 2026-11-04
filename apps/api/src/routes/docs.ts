import { Router } from "express";
import {
  deleteDocController,
  listDocsController,
  uploadDocController,
} from "../controllers";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { handleUploadMiddleware } from "../middleware/upload";

export const docsRouter = Router();

docsRouter.post(
  "/upload",
  requireAuth,
  requireRole("admin", "lead", "responder"),
  handleUploadMiddleware,
  uploadDocController
);
docsRouter.get("/", requireAuth, listDocsController);
docsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "lead"),
  deleteDocController
);

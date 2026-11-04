import { Router } from "express";
import { askCopilotController } from "../controllers";
import { requireAuth } from "../middleware/require-auth";

export const askRouter = Router();

askRouter.post("/", requireAuth, askCopilotController);

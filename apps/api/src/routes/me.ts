import { Router } from "express";
import { getMeController } from "../controllers";
import { requireAuth } from "../middleware/require-auth";

export const meRouter = Router();

meRouter.get("/", requireAuth, getMeController);

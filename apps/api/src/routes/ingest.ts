import { Router } from "express";
import { ingestLogsController } from "../controllers";

export const ingestRouter = Router();

ingestRouter.post("/logs", ingestLogsController);

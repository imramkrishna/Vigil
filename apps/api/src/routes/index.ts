import { Router } from "express";
import { approvalsRouter } from "./approvals";
import { askRouter } from "./ask";
import { docsRouter } from "./docs";
import { incidentsRouter } from "./incidents";
import { meRouter } from "./me";
import { opsRouter } from "./ops";

export const apiRouter = Router();

apiRouter.use("/me", meRouter);
apiRouter.use("/docs", docsRouter);
apiRouter.use("/ask", askRouter);
apiRouter.use("/incidents", incidentsRouter);
apiRouter.use("/approvals", approvalsRouter);
apiRouter.use("/ops", opsRouter);

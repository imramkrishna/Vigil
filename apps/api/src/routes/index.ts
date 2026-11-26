import { Router } from "express";
import { chatsRouter } from "./chats";
import { docsRouter } from "./docs";
import { incidentsRouter } from "./incidents";
import { ingestRouter } from "./ingest";
import { meRouter } from "./me";
import { opsRouter } from "./ops";

export const apiRouter = Router();

apiRouter.use("/me", meRouter);
apiRouter.use("/chats", chatsRouter);
apiRouter.use("/docs", docsRouter);
apiRouter.use("/incidents", incidentsRouter);
apiRouter.use("/ops", opsRouter);
apiRouter.use("/ingest", ingestRouter);

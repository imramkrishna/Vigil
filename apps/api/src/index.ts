import "dotenv/config";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import { auth } from "./auth";
import { requireAuth } from "./middleware/require-auth";

export const app = express();

app.use(
  cors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  })
);

// Mount Better Auth handler BEFORE express.json() so raw request bodies stream cleanly
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "@vigil/api" });
});

// Returns the current authenticated user, active workspace (orgId), and RBAC role
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.auth });
});

const port = Number(process.env.PORT ?? 4000);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`@vigil/api listening on http://localhost:${port}`);
  });
}

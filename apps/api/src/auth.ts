import crypto from "node:crypto";
import {
  db,
  members,
  orgs,
  schema,
  tenantBudgets,
  withOrgContext,
  withUserContext,
} from "@vigil/core";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "vigil-dev-secret-change-in-production-32-chars",
  trustedOrigins: [process.env.WEB_URL ?? "http://localhost:3000"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          // Check under user RLS context whether this user already belongs to an org
          const existing = await withUserContext(createdUser.id, (tx) =>
            tx
              .select()
              .from(members)
              .where(eq(members.userId, createdUser.id))
              .limit(1)
          );

          if (existing.length > 0) return;

          const workspaceName = `${createdUser.name || "Team"}'s Workspace`;
          const [org] = await db
            .insert(orgs)
            .values({ name: workspaceName })
            .returning();

          if (!org) return;

          // Provision membership and tenant budget inside the new org's RLS context
          await withOrgContext(org.id, async (tx) => {
            await tx.insert(members).values({
              orgId: org.id,
              userId: createdUser.id,
              role: "admin",
            });

            await tx.insert(tenantBudgets).values({
              orgId: org.id,
              monthlyLimitUsd: 250,
            });
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;

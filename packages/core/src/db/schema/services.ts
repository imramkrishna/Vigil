import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { orgIntegrations } from "./integrations";
import { orgs } from "./tenancy";

export const DEPLOYMENT_PLATFORMS = [
  "cloud_run",
  "gcp_vm",
  "aws_lambda",
  "aws_ec2",
  "render",
  "vercel",
  "vps",
  "custom",
] as const;
export type DeploymentPlatform = (typeof DEPLOYMENT_PLATFORMS)[number];

export type PlatformConfig =
  | {
      platform: "cloud_run";
      logUrl?: string;
      projectId: string;
      serviceName: string;
      region?: string;
    }
  | {
      platform: "gcp_vm";
      logUrl?: string;
      projectId: string;
      instanceName?: string;
      instanceId?: string;
      zone: string;
      logName?: string;
    }
  | {
      platform: "aws_lambda";
      logUrl?: string;
      region: string;
      functionName: string;
      logGroupName?: string;
    }
  | {
      platform: "aws_ec2";
      logUrl?: string;
      region: string;
      logGroupName: string;
      instanceId?: string;
    }
  | {
      platform: "render";
      logUrl?: string;
      serviceId: string;
      ownerId?: string;
    }
  | {
      platform: "vercel";
      logUrl?: string;
      projectId: string;
      teamId?: string;
      deploymentId?: string;
    }
  | {
      platform: "vps";
      logUrl?: string;
      hostname?: string;
      unitName?: string;
    }
  | {
      platform: "custom";
      logUrl: string;
    };

export const opsServices = pgTable(
  "ops_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id").references(() => orgIntegrations.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    tier: integer("tier").notNull().default(1),
    owner: text("owner"),
    slackChannel: text("slack_channel"),
    repoUrl: text("repo_url"),
    githubBranch: text("github_branch").default("main"),
    platform: text("platform", { enum: DEPLOYMENT_PLATFORMS }),
    logUrl: text("log_url"),
    platformConfig: jsonb("platform_config").$type<PlatformConfig>(),
  },
  (t) => [
    uniqueIndex("ops_services_org_name_uq").on(t.orgId, t.name),
    index("ops_services_org_idx").on(t.orgId),
  ]
);

export const opsDeploys = pgTable(
  "ops_deploys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    sha: text("sha").notNull(),
    author: text("author"),
    configDiff: jsonb("config_diff").$type<Record<string, unknown>>(),
    status: text("status", { enum: ["success", "failed", "rolled_back"] })
      .notNull()
      .default("success"),
    deployedAt: timestamp("deployed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ops_deploys_org_service_time_idx").on(
      t.orgId,
      t.service,
      t.deployedAt
    ),
  ]
);

export type OpsService = typeof opsServices.$inferSelect;
export type NewOpsService = typeof opsServices.$inferInsert;
export type OpsDeploy = typeof opsDeploys.$inferSelect;
export type NewOpsDeploy = typeof opsDeploys.$inferInsert;

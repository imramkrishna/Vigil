import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const ROLES = ["viewer", "responder", "lead", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const members = pgTable(
  "members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull().default("viewer"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })]
);

export type Org = typeof orgs.$inferSelect;
export type Member = typeof members.$inferSelect;

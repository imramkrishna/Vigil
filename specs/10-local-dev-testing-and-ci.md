# Spec 10: Local Setup, Testing & CI

**Status:** Planned (foundation; do this right after Spec 02)
**Fixes:** Issue 10 from [Spec 00](./00-repo-review-and-known-issues.md). Also provides the test framework needed to verify Specs 05–09.

---

## 1. Problem

Today the repo has:
- **No `.env.example`.** New developers don't know which of the ~15 environment variables are needed.
- **No local infrastructure setup.** You need a Neon database with `pgvector` and a Redis server, set up by hand.
- **No seed data.** A fresh workspace is empty, so nothing interesting happens in Ask or Incident mode.
- **No automated tests** and **no CI.** Every change is checked by hand, and the most important property (tenant isolation) has no test at all.

A reviewer or new teammate should be able to **clone the repo and run a working demo in about 10 minutes**, and every pull request should be checked automatically.

---

## 2. Environment Template (`.env.example`)

Add a committed `.env.example` at the repo root (`.gitignore` already allows it). Every variable gets a comment, and variables are grouped and marked as required or optional:

| Group | Variables | Required? |
| :--- | :--- | :--- |
| Database | `DATABASE_URL` | Required |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Required |
| LLM | `OPENROUTER_API_KEY` | Required |
| Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_URL` | Required |
| Storage | S3 endpoint, keys and bucket | Required for runbook uploads |
| GitHub | `GITHUB_TOKEN` (fallback), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional |
| Web tools | `FIRECRAWL_API_KEY` | Optional |
| Log providers | `GCP_ACCESS_TOKEN`, `RENDER_API_KEY`, `VERCEL_TOKEN`, `AWS_CLOUDWATCH_*`, `LOG_PROVIDER_TOKEN` | Optional |
| Frontend | `NEXT_PUBLIC_API_URL` | Required |

**Startup check:** the API and worker check required variables at startup and exit with a clear list of what's missing. Today some modules fail later, at first use, with confusing errors.

**Naming cleanup:** the current README uses mixed-case Redis variable names (`REDIS_Host`, `REDIS_Password`). Standardize on upper case and update code and docs together.

---

## 3. Local Infrastructure (Docker Compose)

A `docker-compose.yml` at the repo root starts:

| Service | Image choice | Purpose |
| :--- | :--- | :--- |
| `postgres` | A PostgreSQL image with the `pgvector` extension included | Local replacement for Neon |
| `redis` | Official Redis image | BullMQ queues and caching (Spec 05) |
| `minio` (optional) | MinIO | Local S3-compatible storage for runbook uploads |

Then:
1. `pnpm db:migrate` applies migrations, including RLS policies and the `tsv` trigger.
2. `pnpm db:seed` loads the demo data (section 4).
3. `pnpm dev` starts web, api and worker together (already exists).

---

## 4. Seed Data (`pnpm db:seed`)

Creates one realistic demo org, **"Acme Payments"**, plus a second, empty org used to test isolation:

| Data | Contents |
| :--- | :--- |
| Users | One user per role (`admin`, `lead`, `responder`, `viewer`) with known demo passwords, printed after seeding |
| Services | 3–4 services (`checkout-api`, `payments-worker`, `auth-service`) with tiers, owners, Slack channels and platforms |
| Deploys | About 10 recent deploys, including one bad deploy that matches a seeded incident scenario |
| Past incidents | About 8 historical incidents with root causes and resolutions |
| Runbooks | 3–4 short markdown or PDF runbooks (rollback procedure, connection pool tuning, on-call escalation), already chunked and embedded |
| Budget | A tenant budget row with a small amount of usage |

The seed script is **idempotent**: running it twice doesn't create duplicates. The evaluation harness ([Spec 06](./06-evaluation-harness.md)) reuses the same fixtures.

---

## 5. Shared Types (`@vigil/shared`)

`packages/shared/src/index.ts` is empty, and `apps/web/types/vigil.ts` re-declares backend types. They have already drifted apart (for example incident status `mitigating` in the web types versus `monitoring` in the database schema).

**Plan:**
1. Move all API request and response shapes (incident, approval, proposed action, citation, hypothesis, service registration, deploy, log entry, `/api/me` user) into `@vigil/shared`.
2. Both `apps/api` controllers and `apps/web/lib/api.ts` import from `@vigil/shared`.
3. Optional: define them as Zod schemas (Zod is already a dependency) so the API validates request bodies with the same definitions the frontend uses.

---

## 6. Testing Strategy

Use **Vitest** for all TypeScript packages: it's fast, supports TypeScript natively and works in a pnpm monorepo.

| Layer | What to test | Examples |
| :--- | :--- | :--- |
| **Unit** (no database, no network) | Pure functions | `parseGitHubRepo` with full URLs, `.git` suffixes, shorthand and invalid input; log level normalization; cost calculation; action validation rules (Spec 07) |
| **Database integration** (real Postgres from Docker) | RLS and queries | **Tenant isolation test** (most important): create two orgs, insert data in both, and assert every query and API route as org B returns zero rows from org A. GitHub token selection rules (Spec 07). Idempotent `action_log`. |
| **API integration** (Supertest against the Express app) | Routes and RBAC | `viewer` gets `403` on approve; unauthenticated requests get `401`; webhook signature checks (Spec 05) |
| **Graph tests** (fake LLM) | Routing and control flow | Feed scripted model responses to check that `ask` goes through `synthesizeAnswer` and `verifyGrounding`; `incident` pauses at `awaitApproval`; resuming with "approved" runs `executeAction` exactly once; the tool-round limit stops at 4 |
| **Frontend** (optional, later) | Key flows | Playwright: log in, ask a question, approve an action |

**External calls in tests:** mock Octokit, log providers, Firecrawl and OpenRouter. No test should need network access.

---

## 7. Continuous Integration (GitHub Actions)

One workflow on every pull request and every push to `main`:

| Job | Steps | Notes |
| :--- | :--- | :--- |
| `typecheck` | Install with pnpm (cached), run `tsc --noEmit` for every package | Fast. Catches most mistakes. |
| `lint` | ESLint across the monorepo | Add ESLint if not configured. |
| `test` | Start Postgres (pgvector) and Redis as service containers, run migrations, run Vitest | Includes the tenant isolation test. |
| `eval-retrieval` | Retrieval suite from Spec 06 | Deterministic, no LLM cost. |
| `eval-full` | Full evaluation suite | Only when graph, prompt, model or retrieval files change. Needs the `OPENROUTER_API_KEY` secret. |

**Branch protection:** require `typecheck`, `test` and `eval-retrieval` to pass before merging to `main`.

---

## 8. Containerized Deployment (later)

- One Dockerfile per app (`api`, `worker`, `web`) using multi-stage builds, so production images contain only built output and production dependencies.
- The API runs migrations as a separate one-off step on deploy, never automatically at startup.
- Health endpoints: `/health` exists on the API. Add a similar check to the worker (Redis and database reachable).

---

## 9. Non-goals
- Full end-to-end browser test coverage (only a few key flows).
- Multi-region or Kubernetes deployment manifests.

## 10. Acceptance Criteria
- [ ] A new developer can go from `git clone` to a working demo (log in, ask a question with citations, run an incident to the approval step) in about 10 minutes, using only the README instructions.
- [ ] `.env.example` lists every variable the code reads, with a comment for each.
- [ ] `pnpm db:seed` creates the demo org and can be run twice safely.
- [ ] The tenant isolation test exists, runs in CI, and fails if RLS is disabled on any tenant table.
- [ ] CI runs typecheck, lint and tests on every pull request, and merging is blocked on failure.
- [ ] `apps/web/types/vigil.ts` is replaced by imports from `@vigil/shared`.

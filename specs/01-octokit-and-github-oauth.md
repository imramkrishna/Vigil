# Spec 01: Multi-Tenant Octokit & GitHub OAuth Integration

**Status:** Implemented (known gaps — see Section 5 and [Spec 00](./00-repo-review-and-known-issues.md))

## 1. Overview

Vigil inspects recent GitHub commits, file-level diff patches, and repository runbooks during incident investigations and service deploy lookups. Because Vigil is a multi-tenant workspace where different engineering teams register their own services and repositories, GitHub API access must support both **public repositories** out of the box and **private repositories** belonging to any registered user.

---

## 2. Token Resolution Architecture

```mermaid
flowchart TD
    Req["GitHub Operation Triggered<br/>(fetchGitHubDeploysForOrg / executeAction)"] --> Lookup["Query getOrgGitHubToken(orgId)<br/>in packages/core/src/ops/queries.ts"]
    Lookup --> CheckDB{"Connected GitHub OAuth row<br/>in account + members?"}
    CheckDB -- "Yes (accessToken found)" --> UserOctokit["createOctokit(userAccessToken)<br/>Reads private & public repos for that org"]
    CheckDB -- "No" --> FallbackOctokit["createOctokit(process.env.GITHUB_TOKEN)<br/>Reads any public repo at 5,000 req/hr"]
```

### 2.1 Two-Tier Credential Strategy
1. **Organization Member OAuth Token (`account.accessToken`)**
   - When a user signs in with GitHub or clicks **Connect GitHub** in **Settings → Profile**, Better Auth stores their OAuth `accessToken` (with `repo`, `read:user`, and `user:email` scopes) in the PostgreSQL `account` table (`provider_id = 'github'`).
   - `getOrgGitHubToken(orgId)` in `packages/core/src/ops/queries.ts` runs inside `withOrgContext(orgId)` and joins `account` with `members` to retrieve the workspace's connected GitHub token.
2. **Server Fallback Token (`process.env.GITHUB_TOKEN`)**
   - If a workspace has not linked a GitHub account yet, `createOctokit` in `packages/core/src/config/octokit.ts` falls back to `process.env.GITHUB_TOKEN`.
   - This allows Vigil to query any public repository on GitHub with authenticated rate limits (5,000 requests/hour instead of 60 requests/hour).

---

## 3. Core Octokit Operations (`packages/core/src/ops/github.ts`)

| Function | Octokit REST Method | Purpose |
| :--- | :--- | :--- |
| **`parseGitHubRepo`** | N/A (URL parser) | Extracts `{ owner, repo }` from full GitHub URLs (`https://github.com/owner/repo`) or shorthand slugs (`owner/repo`). |
| **`fetchGitHubCommitsForRepo`** | `octokit.rest.repos.listCommits` & `octokit.rest.repos.getCommit` | Fetches the latest commits on a service's configured branch (`githubBranch`) along with additions/deletions statistics and per-file diff patches. |
| **`fetchGitHubDeploysForOrg`** | Calls `fetchGitHubCommitsForRepo` per service | Resolves the org's GitHub token via `getOrgGitHubToken(orgId)`, queries all matching services with a `repoUrl` in `ops_services`, and merges their latest commits sorted by timestamp. |
| **`fetchGitHubFileContent`** | `octokit.rest.repos.getContent` | Reads and decodes base64 file contents (such as `README.md`, `CHANGELOG.md`, or `docs/` runbooks) from a service's repository branch. |
| **`createGitHubIssueForRepo`** | `octokit.rest.issues.create` | Opens a GitHub Issue on the target service repository when an operator approves a `create_ticket` remediation action. |

---

## 4. Better Auth & Frontend OAuth Flows

1. **Backend Auth Configuration (`apps/api/src/auth.ts`)**
   - Enables `account.accountLinking` for `github` so existing email/password users can link their GitHub account without creating a duplicate user record.
   - Configures `socialProviders.github` using `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` with `repo`, `read:user`, and `user:email` scopes.
2. **Identity Endpoint (`GET /api/me` in `apps/api/src/controllers/me.controller.ts`)**
   - Checks `getOrgGitHubToken(req.auth.orgId)` and returns `githubConnected: boolean` on the `user` object.
3. **Frontend Entry Points (`apps/web`)**
   - **Login & Signup Pages (`app/login/page.tsx`, `app/signup/page.tsx`)** — Provide a **Continue with GitHub** button calling `signInWithGitHub()` (`/api/auth/sign-in/social`).
   - **Workspace Settings (`components/SettingsView.tsx`)** — Displays a **GitHub Integration** card showing `Connected` or `Not connected` status and a **Connect GitHub** / **Reconnect GitHub** button calling `connectGitHubAccount()` (`/api/auth/link-social`).

---

## 5. Known Gaps (from [Spec 00](./00-repo-review-and-known-issues.md))

The core integration works, but three issues stop this spec from being fully done:

| Gap | Issue | Planned fix |
| :--- | :--- | :--- |
| **Token selection is random and ignores roles.** `getOrgGitHubToken` returns any member's token, so a `viewer`'s token can be used for writes. | Issue 3 | Separate read and write token rules: [Spec 07, section 4](./07-security-and-threat-model.md). |
| **Errors are hidden.** Every Octokit call returns an empty result on failure, so an expired or revoked token looks like "no commits". | Issue 5 | Return a typed result that separates *empty*, *unauthorized*, *rate-limited* and *not found*. Show "Reconnect GitHub" in Settings when the token is rejected, and add a note to the agent timeline when GitHub evidence couldn't be loaded. |
| **Too many calls, no caching.** Up to 33 GitHub requests per deploy lookup. | Issue 6 | Redis cache plus webhook ingestion: [Spec 05](./05-github-webhooks-and-proactive-ingestion.md). |

Also note: `githubConnected` in `GET /api/me` only checks that a token **exists**, not that it still **works**. Once error types are added, store the last known token status and return it instead.

---

## 6. Non-goals
- GitHub Enterprise Server (self-hosted) URLs. Only `github.com` is supported for now.
- Pasting a token per service. Considered earlier, but dropped in favor of OAuth now and a GitHub App later ([Spec 11](./11-integrations-roadmap.md)).
- GitLab and Bitbucket.

## 7. Failure Cases

| Failure | Current behavior | Target behavior |
| :--- | :--- | :--- |
| Repo URL can't be parsed | Returns no commits | Same, but the Add Service modal rejects invalid URLs before saving. |
| Private repo with no connected token | Returns no commits (GitHub returns 404) | Timeline note: "Repository not accessible. Connect GitHub in Settings." |
| Token revoked or expired | Returns no commits | Connection marked broken, Settings shows "Reconnect GitHub". |
| Rate limit reached | Returns no commits | Serve cached data if available, otherwise a timeline note with the reset time. |

## 8. Acceptance Criteria
- [x] `createOctokit` uses the given token or falls back to `GITHUB_TOKEN`.
- [x] Commits and per-file diffs are fetched with `listCommits` and `getCommit`.
- [x] Users can sign in with GitHub and link GitHub from Settings.
- [x] `GET /api/me` returns `githubConnected`.
- [ ] Token selection follows the role rules in Spec 07 (tested).
- [ ] An invalid token shows up as "Reconnect GitHub" in Settings instead of silently returning no data.
- [ ] Repeated deploy lookups within 60 seconds hit the cache instead of GitHub.

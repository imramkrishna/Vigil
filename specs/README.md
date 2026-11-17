# Vigil Engineering Specifications (`specs/`)

This directory contains the architectural and functional specifications for Vigil's operational subsystems, integration pipelines, and upcoming roadmap milestones.

---

## Specification Index

| Spec File | Subsystem | Status | Summary |
| :--- | :--- | :--- | :--- |
| **[`01-octokit-and-github-oauth.md`](./01-octokit-and-github-oauth.md)** | GitHub & Octokit Integration | **Implemented** | Multi-tenant GitHub access using `@octokit/rest`, Better Auth GitHub OAuth account linking, per-organization token resolution, commit/diff fetching, and repository file retrieval. |
| **[`02-hitl-approvals-and-action-execution.md`](./02-hitl-approvals-and-action-execution.md)** | HITL Approvals & Action Execution | **Next Up** | End-to-end `approvalId` propagation from LangGraph `interrupt()` to the frontend chat and Approvals Inbox, plus real GitHub Issue creation via Octokit inside `executeAction`. |
| **[`03-live-logs-and-platform-adapters.md`](./03-live-logs-and-platform-adapters.md)** | Multi-Platform Live Logs & `logUrl` | **Planned** | Exposing `fetchLogs` and `fetchLiveLogs` over `GET /api/ops/logs`, validating service log endpoints in the Add Service modal, and streaming live logs into the Evidence Drawer. |
| **[`04-incident-room-and-approvals-sync.md`](./04-incident-room-and-approvals-sync.md)** | Incident Room & Approvals UI Sync | **Planned** | Real-time state synchronization across Copilot Chat, Incident Room, and Approvals Inbox when remediation actions are approved or rejected. |

---

## Related Documentation

- **[Root `README.md`](../README.md)** — Complete system architecture, LangGraph topology, database schema, API surface, and environment configuration.
- **[`@vigil/web README.md`](../apps/web/README.md)** — Next.js 16 frontend component hierarchy and workspace views.
- **[`features/github-commit-and-doc-ingestion.md`](../features/github-commit-and-doc-ingestion.md)** — Proactive and reactive GitHub commit, diff, and runbook ingestion flows.

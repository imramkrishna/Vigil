# Vigil Engineering Specifications (`specs/`)

This folder holds Vigil's design specifications: what each subsystem does, why it's built that way, what's left to do, and how we know it's finished.

**Start here:** [Spec 00: Repository Review & Known Issues](./00-repo-review-and-known-issues.md) lists the current strengths, the open issues, and the recommended order of work.

---

## Specification Index

| Spec | Area | Status | Summary |
| :--- | :--- | :--- | :--- |
| **[00](./00-repo-review-and-known-issues.md)** | Repo review | Living document | Strengths, 10 known issues with severity and impact, and the recommended build order. |
| **[01](./01-octokit-and-github-oauth.md)** | GitHub & Octokit | Implemented (known gaps) | Multi-tenant GitHub access with `@octokit/rest`, GitHub OAuth through Better Auth, commit and diff fetching. Gaps: token selection, hidden errors, no caching. |
| **[02](./02-hitl-approvals-and-action-execution.md)** | Approvals & actions | **Next up** | Fix the `approvalId` handoff (chat approve returns 404 today) and create real GitHub issues when actions are approved. |
| **[03](./03-live-logs-and-platform-adapters.md)** | Live logs | Planned | `GET /api/ops/logs`, real "Test connection", live logs in the Evidence Drawer, and log safety rules. |
| **[04](./04-incident-room-and-approvals-sync.md)** | UI state sync | Planned | Keep chat, Incident Room and Approvals Inbox consistent after decisions. |
| **[05](./05-github-webhooks-and-proactive-ingestion.md)** | GitHub webhooks | Planned | Save commits as they happen, auto-ingest markdown runbooks from repos, and cache live GitHub calls. |
| **[06](./06-evaluation-harness.md)** | Evaluation | Planned | Scored test suites for retrieval, groundedness, incident paths, action safety and prompt injection, with a CI gate. |
| **[07](./07-security-and-threat-model.md)** | Security | Planned | Threat model, prompt-injection controls, GitHub token rules, encrypted tokens, audit requirements. |
| **[08](./08-streaming-investigations.md)** | Streaming | Planned | Stream investigation steps to the browser with SSE instead of a 30–60 second spinner. |
| **[09](./09-feedback-and-observability.md)** | Feedback & tracing | Planned | Thumbs up/flag feedback, audit log, tracing and a metrics dashboard. |
| **[10](./10-local-dev-testing-and-ci.md)** | Foundation | Planned (high priority) | `.env.example`, Docker Compose, seed data, shared types, Vitest, tenant isolation test, GitHub Actions CI. |
| **[11](./11-integrations-roadmap.md)** | Integrations | Planned | Slack status and approvals, PagerDuty/Alertmanager auto-incidents, approval watchdog, GitHub App. |

### Recommended order
**02 → 10 → 07 → 05 → 06 → 03 / 04 / 08 / 09 → 11.** The reasoning is in [Spec 00, section 3](./00-repo-review-and-known-issues.md).

---

## Status Meanings

| Status | Meaning |
| :--- | :--- |
| **Planned** | Designed, not started. |
| **Next up** | The next spec to implement. |
| **In progress** | Some acceptance criteria are checked. |
| **Implemented (known gaps)** | Core works, but some acceptance criteria are still open. |
| **Done** | Every acceptance criterion is checked and covered by tests where stated. |
| **Living document** | Updated continuously, has no "done" state. |

---

## Spec Template

Every new spec should use these sections, in order:

1. **Status**, plus which issues it fixes and which specs it depends on.
2. **Problem:** what is wrong or missing today, and why it matters.
3. **Solution / Design:** how it will work, with a diagram where it helps. Describe behavior in prose and tables, without code snippets.
4. **API, data and UI changes:** endpoints, tables and components affected.
5. **Security notes:** anything that touches untrusted input, credentials or permissions.
6. **Non-goals:** what this spec deliberately leaves out.
7. **Failure cases:** a table of what can go wrong and the expected behavior.
8. **Acceptance criteria:** a checklist. The spec is **Done** only when every box is checked.

When an acceptance criterion is met, tick its box and update the status column above. When an issue in Spec 00 is resolved, mark it **Resolved** there too.

---

## Related Documentation
- **[Root `README.md`](../README.md):** system architecture, LangGraph workflow, database schema, API endpoints and environment variables.
- **[`apps/web/README.md`](../apps/web/README.md):** frontend components and workspace views.

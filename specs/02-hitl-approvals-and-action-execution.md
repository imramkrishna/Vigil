# Spec 02: Human-in-the-Loop Approvals & Real Action Execution

## 1. Overview

When Vigil investigates an incident in `incident` mode, the `formHypotheses` node ranks root causes and proposes a concrete remediation action (`ProposedAction` with `kind` set to `create_ticket`, `post_status`, or `schedule_followup`). Before any external write occurs, the workflow pauses at the `awaitApproval` node using LangGraph's `interrupt()` mechanism and records a pending row in the `approvals` table.

This specification defines the end-to-end `approvalId` handoff and the real external action execution inside `executeAction`.

---

## 2. Approval Lifecycle & `approvalId` Handoff

```mermaid
sequenceDiagram
    participant UI as Vigil Frontend (Chat / Inbox)
    participant API as @vigil/api (incidents & approvals controllers)
    participant Graph as @vigil/graphs (awaitApproval & executeAction)
    participant DB as PostgreSQL (approvals & action_log)
    participant GH as GitHub API (Octokit)

    UI->>API: POST /api/incidents (title, severity, symptomSummary)
    API->>Graph: graph.invoke({ mode: "incident", ... })
    Graph->>DB: createPendingApproval() -> inserts pending row in approvals
    Graph->>DB: updateIncidentStatus("awaiting_approval")
    Graph-->>API: Pauses at interrupt({ approvalId, incidentId, proposedAction })
    API->>DB: listApprovalsForIncident(orgId, incident.id)
    API-->>UI: 201 Created { incident, approvalId, hypotheses, proposedAction }
    UI->>API: POST /api/approvals/:approvalId/decide ({ decision: "approved" })
    API->>DB: decideApproval() -> updates approvals row
    API->>Graph: graph.invoke(Command({ resume: { decision: "approved" } }))
    Graph->>DB: findActionLogByKey(orgId, idempotencyKey)
    Graph->>GH: createGitHubIssueForRepo() (when kind = "create_ticket")
    Graph->>DB: saveActionLog() & updateIncidentStatus("monitoring")
    Graph-->>API: Returns { executionResult, answer, timeline }
    API-->>UI: Returns approval decision & executionResult (with GitHub Issue URL)
```

---

## 3. Required Implementation Details

### 3.1 Returning `approvalId` on Incident Creation (`apps/api/src/controllers/incidents.controller.ts`)
- Because `interrupt()` in `packages/graphs/src/nodes/awaitApproval.ts` suspends execution before `awaitApproval` returns its state update, `state.approvalId` is not yet populated on the state object returned by `graph.invoke()`.
- After `graph.invoke()` completes in `createIncidentController`, the controller queries `listApprovalsForIncident(orgId, incident.id)` and includes `approvalId: pendingApproval?.id ?? null` in the `POST /api/incidents` response payload.
- In `apps/web/components/chat/VigilCopilotChat.tsx` (and `apps/web/lib/api.ts`), the assistant turn stores `approvalId: data.approvalId` so clicking **Approve & Execute** or **Reject Action** in the chat panel calls `POST /api/approvals/:approvalId/decide` with the valid approval UUID.

### 3.2 Real External Execution in `executeAction` (`packages/graphs/src/nodes/executeAction.ts`)
1. **Idempotency Check**
   - Queries `findActionLogByKey(state.orgId, state.proposedAction.idempotencyKey)`. If a result already exists in `action_log`, returns the cached result immediately without re-running the external side effect.
2. **Action Dispatch by `kind`**
   - **`create_ticket`**:
     - Looks up the target service in `ops_services` via `getServiceByName(state.orgId, targetService)` (or `listOpsServices(state.orgId)` fallback) to obtain its `repoUrl`.
     - Resolves the workspace's GitHub token via `getOrgGitHubToken(state.orgId)`.
     - Calls `createGitHubIssueForRepo` with the proposed action title, rationale, evidence IDs, and severity label, storing `{ issueNumber, issueUrl }` in `executionResult`.
   - **`post_status`**:
     - Formats the status broadcast for the target Slack channel (`slackChannel`) and records the broadcast payload in `executionResult` (and posts to `SLACK_WEBHOOK_URL` if configured).
   - **`schedule_followup`**:
     - Records the follow-up task and owner metadata in `executionResult`.
3. **Persistence & State Transition**
   - Saves `executionResult` to `action_log` via `saveActionLog` and transitions the incident status to `monitoring` via `updateIncidentStatus`.

# Spec 04: Incident Room & Approvals Inbox State Synchronization

## 1. Overview

Operators can interact with active incidents and remediation approvals from two places in the Vigil workspace:
1. **Inline inside `VigilCopilotChat.tsx`** (via `IncidentHypothesisPanel.tsx`).
2. **Dedicated dashboard views** (`IncidentRoomView.tsx` and `ApprovalsInboxView.tsx`).

This specification ensures that state transitions, approval decisions, and execution outputs (such as newly created GitHub Issue links) stay synchronized across all views.

---

## 2. State Synchronization Requirements

| View Component | Data Source | Required Behavior |
| :--- | :--- | :--- |
| **`VigilCopilotChat.tsx`** | `POST /api/incidents` & `POST /api/approvals/:id/decide` | Stores the real `approvalId` returned by `POST /api/incidents`. When the operator approves or rejects the action inline, appends the resumed assistant response and displays any created GitHub Issue link from `executionResult`. |
| **`ApprovalsInboxView.tsx`** | `GET /api/approvals` & `POST /api/approvals/:id/decide` | Lists pending and historical approvals for the organization. When an authorized operator (`admin` or `lead`) clicks **Approve** or **Reject**, updates the item state and displays the execution summary returned by the resumed LangGraph thread. |
| **`IncidentRoomView.tsx`** | `GET /api/incidents` & `GET /api/incidents/:id` | Reflects the live incident status (`investigating` -> `awaiting_approval` -> `monitoring` -> `resolved`), displays the linked approval status, and allows jumping directly to Postmortem generation once resolved or mitigated. |

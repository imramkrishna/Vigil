# Spec 04: Incident Room & Approvals Inbox State Synchronization

**Status:** Planned
**Depends on:** [Spec 02](./02-hitl-approvals-and-action-execution.md).

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

---

## 3. Design Notes
- **One source of truth.** All three views read incident and approval state from the API, never from their own local copies. After any decision, each view refreshes the affected incident and approval from the server.
- **Matching status names.** The web types use `mitigating` but the database uses `monitoring`. Fix this by sharing types through `@vigil/shared` ([Spec 10, section 5](./10-local-dev-testing-and-ci.md)).
- **Live updates.** Short-term: refresh on window focus, plus a 10-second refresh on the Approvals Inbox. Long-term: subscribe to the incident's event stream ([Spec 08](./08-streaming-investigations.md)) so all open views update instantly.
- **Execution results everywhere.** When an action runs, show its result (for example the GitHub issue link) in the chat turn, on the approval row in the inbox, and in the Incident Room timeline.

## 4. Non-goals
- Real-time collaboration (several cursors, presence indicators).
- Offline mode.

## 5. Failure Cases

| Failure | Expected behavior |
| :--- | :--- |
| Two leads decide the same approval from different views at once | The first decision wins. The second gets `409` and the view refreshes to show the existing decision and who made it. |
| Approval decided in another tab | The current view shows the new state on the next refresh or focus, and the approve buttons are disabled. |
| API unreachable | Show an error banner. **Never** show fake demo data in place of real incidents once the user is logged in. |

## 6. Acceptance Criteria
- [ ] Approving in the chat panel updates the Approvals Inbox and Incident Room within 10 seconds (or immediately once Spec 08 is done).
- [ ] Approving in the Approvals Inbox updates the matching chat turn when it's opened.
- [ ] Incident status names are the same in every view and match the database.
- [ ] The GitHub issue link from an executed action appears in all three views.
- [ ] Logged-in users never see the offline demo data in place of real data.

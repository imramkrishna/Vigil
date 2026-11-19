# Spec 11: Integrations Roadmap

**Status:** Planned (after the core is safe and tested)

This spec groups four integrations that make Vigil part of a team's real incident workflow, instead of a separate tool people have to remember to open.

---

## 1. Slack: Real Status Updates and Approvals

### 1.1 Problem
`post_status` actions are only recorded in `action_log`. Nothing is actually posted. During an incident, the team lives in Slack, not in Vigil's dashboard.

### 1.2 Design
| Phase | Capability | How |
| :--- | :--- | :--- |
| **Phase 1** | Post status updates | When a `post_status` action is approved, post the message to the service's `slackChannel` (from `ops_services`), using a Slack incoming webhook URL stored per org (encrypted). |
| **Phase 2** | Approve from Slack | Use a Slack app with interactive buttons. The message shows the proposed action, evidence summary and **Approve** / **Reject** buttons. Clicking calls back to Vigil, which checks that the Slack user maps to a Vigil member with the `lead` or `admin` role before recording the decision. |
| **Phase 3** | Ask from Slack | A slash command (for example `/vigil why is checkout failing?`) runs Ask mode and replies in a thread with citations. |

### 1.3 Safety rules
- Verify Slack's request signature on every callback, the same way as GitHub webhooks.
- A Slack user with no linked Vigil account, or without the right role, can see approval messages but can't approve.

### 1.4 Acceptance criteria
- [ ] An approved `post_status` action posts to the correct Slack channel, and the message link is stored in `action_log`.
- [ ] (Phase 2) A `lead` can approve from Slack. A `viewer` clicking Approve gets an "insufficient permissions" reply and nothing is recorded.

---

## 2. PagerDuty and Alertmanager: Automatic Incident Creation

### 2.1 Problem
Today someone has to notice an alert, open Vigil and type the symptoms. The investigation should start the moment the alert fires, so findings are ready when the on-call engineer opens the incident.

### 2.2 Design
1. **Inbound webhook endpoints:** `POST /api/webhooks/pagerduty` and `POST /api/webhooks/alertmanager`, each with signature or shared-secret verification and a per-org identifier in the URL.
2. **Mapping:** convert the alert into an incident: title from the alert summary, severity from alert priority (configurable mapping, for example P1 → SEV-1), service from alert labels matched against `ops_services`.
3. **Duplicate protection:** use the alert's own ID (PagerDuty incident ID or Alertmanager fingerprint) as a deduplication key, so repeated or flapping alerts don't start several investigations.
4. **Auto-investigate:** start the incident graph automatically. It runs up to the approval step, then waits for a human. **No action is ever executed automatically.**
5. **Resolve sync:** when the alert resolves upstream, add a timeline note and suggest moving the incident to `monitoring` or `resolved`.

### 2.3 Acceptance criteria
- [ ] A firing Alertmanager alert creates exactly one incident, even if the alert is sent several times.
- [ ] The investigation starts automatically and stops at the approval step.
- [ ] A resolved alert adds a timeline note to the matching incident.

---

## 3. Approval Watchdog: Escalation for Stuck Approvals

### 3.1 Problem
An approval can wait forever. If the on-call lead is asleep or misses the notification, a SEV-1 fix sits in the queue with nobody watching. Because the graph is checkpointed, the wait survives restarts, which is good, but nothing notices how long it's been.

### 3.2 Design
A repeating background job in `@vigil/worker` (BullMQ repeatable job, every minute):

| Severity | Remind after | Escalate after | Escalation action |
| :--- | :--- | :--- | :--- |
| SEV-1 | 5 minutes | 15 minutes | Notify all `lead` and `admin` members (Slack and email), and mark the approval as escalated in the UI |
| SEV-2 | 15 minutes | 60 minutes | Notify all leads |
| SEV-3 | 1 hour | 24 hours | Daily digest |

Thresholds can be set per org. Each reminder and escalation writes an `audit_events` row. The watchdog **never** approves or rejects anything itself; it only notifies people.

**Stale approvals:** if an approval is still pending after a long limit (for example 7 days), mark it `expired`. Resuming an expired approval needs a fresh investigation, because the evidence is probably out of date.

### 3.3 Acceptance criteria
- [ ] A SEV-1 approval pending for 15 minutes triggers an escalation notification and an audit row.
- [ ] The watchdog never changes an approval's decision.
- [ ] Expired approvals can't be approved, and the UI explains why.

---

## 4. GitHub App: Replacing OAuth for Repository Access

### 4.1 Problem
The current OAuth approach ([Spec 01](./01-octokit-and-github-oauth.md)) has three drawbacks:
- The `repo` scope gives full read/write access to **every** private repo the user can reach (Issue 7 in [Spec 00](./00-repo-review-and-known-issues.md)).
- Access is tied to one person. If they leave the company or revoke the token, the workspace loses GitHub access.
- Webhooks must be set up by hand for every repo ([Spec 05](./05-github-webhooks-and-proactive-ingestion.md)).

### 4.2 Design
Register a **Vigil GitHub App** (this is how Vercel, Sentry and Linear do it):

| Aspect | OAuth today | GitHub App |
| :--- | :--- | :--- |
| Which repos | All repos the user can access | Only the repos the customer picks during install |
| Permissions | `repo` (full read/write) | Fine-grained: Contents read-only, Metadata read-only, Issues read/write, Deployments read-only |
| Who owns access | One user | The organization's installation |
| Token lifetime | Long-lived, stored in the database | Short-lived (about 1 hour), created on demand from the app's private key |
| Webhooks | Set up by hand per repo | Sent automatically for all installed repos |

**Flow:**
1. An admin clicks **Install GitHub App** in Settings, picks repositories on GitHub and is redirected back with an installation ID.
2. Vigil stores the installation ID on the `orgs` row (new column) and lists the installed repos so services can be linked from a dropdown instead of pasting URLs.
3. `createOctokit` gains a new mode that creates a short-lived installation token for the org when needed.
4. **Write actions:** to keep "the approver did this" accountability, either keep using the approver's OAuth token for writes, or write as the app and include the approver's name in the issue body. Pick one and document it in Spec 07.
5. OAuth stays supported during the move. If an org has an installation, it is used for reads; otherwise the existing token rules apply.

### 4.3 Acceptance criteria
- [ ] An admin can install the app on selected repos, and Vigil can read commits only from those repos.
- [ ] No long-lived GitHub token is stored for orgs using the app.
- [ ] `push` webhooks arrive automatically for installed repos, with no manual setup.
- [ ] Removing the app on GitHub marks the integration as disconnected in Vigil within one webhook delivery.

---

## 5. Non-goals
- Jira, Linear or ServiceNow ticketing (good candidates for a future spec once the GitHub Issues path in Spec 02 works).
- Microsoft Teams (similar to Slack; a later spec if needed).
- Any fully automatic remediation with no human approval.

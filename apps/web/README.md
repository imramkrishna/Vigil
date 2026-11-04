# @vigil/web — Vigil Next.js Frontend Workspace

`@vigil/web` is the Next.js 16 (App Router) frontend for **Vigil**, the Autonomous Engineering Operations & Incident Copilot.

---

## Overview

The web application provides a unified dark-mode operational workspace connecting engineers to Vigil's LangGraph workflows, hybrid runbook search, GitHub deployment tracing, and human-in-the-loop (HITL) approval gates.

---

## Key Views & Components

### 1. Copilot Workspace (`components/chat/`)
- **VigilCopilotChat** — Full-height conversational copilot supporting `Ask Copilot`, `Incident`, and `Postmortem` modes, active thread management, starter prompts, and automatic fallback to interactive demo responses when the backend is offline.
- **PromptComposer** — Floating command bar with mode switching, severity selection (`SEV-1`, `SEV-2`, `SEV-3`), slash-command chips (`/runbooks`, `/deploys`, `/live-logs`, `/web`), and direct `.pdf` runbook upload integration (`POST /api/docs/upload`).
- **AgentTimelineTrace** — Collapsible execution trace displaying each step taken by the LangGraph agent.
- **CitationCards** — Displays grounding verification status, confidence badges, and expandable source excerpts from indexed runbooks and telemetry.
- **IncidentHypothesisPanel** — Renders ranked root-cause hypotheses with confidence bars alongside the Human-in-the-Loop remediation card (`Approve & Execute` / `Reject Action`).
- **PostmortemArtifactCard** — Multi-tab postmortem viewer with formatted preview, prioritized action items (`P0`, `P1`, `P2`), raw Markdown inspection, and one-click copy/download.
- **EvidenceDrawer** — Slide-over right-hand panel organizing verified runbook sources, live logs, and GitHub commit diffs.

### 2. Service Configuration (`components/ops/ServicePlatformModal.tsx`)
- Interactive modal for registering or updating services in the service catalog (`POST /api/ops/services`), including GitHub repository auto-detection (`repoUrl` and `githubBranch`), service criticality tier, owner, Slack channel, and cloud platform settings (`Cloud Run`, `Lambda`, `EC2`, `Render`, `Vercel`, `Custom`).

### 3. Dashboard Views (`app/dashboard/page.tsx` & `components/`)
- **Incident Room (`IncidentRoomView.tsx`)** — Live incident progress tracker (`Triage`, `Investigate`, `Rank causes`, `Awaiting approval`, `Resolve`), ranked likely causes, evidence viewer, and timeline notes.
- **Approvals Inbox (`ApprovalsInboxView.tsx`)** — Role-gated inbox for reviewing and deciding pending remediation actions (`GET /api/approvals` and `POST /api/approvals/:id/decide`).
- **Runbooks & Usage (`DocsAdminAndOpsView.tsx`)** — Displays monthly LLM token spend against the organization budget (`GET /api/ops/budget`), lists indexed PDF runbooks (`GET /api/docs`), and supports uploading or deleting documents.
- **Postmortems (`PostmortemEditorView.tsx`)** — Markdown preview and editor that triggers `POST /api/incidents/:id/postmortem` for any investigated incident.
- **Authentication (`app/login/page.tsx` & `app/signup/page.tsx`)** — Better Auth email/password sign-in and workspace creation flows.

### 4. API Client (`lib/api.ts`)
- Centralized, strongly-typed fetch client communicating with `@vigil/api` (`NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:4000`) with session cookies enabled.

import crypto from "node:crypto";
import type { Request, Response } from "express";
import {
  createIncident,
  getIncidentById,
  listApprovalsForIncident,
  listIncidents,
  SEVERITIES,
  type Severity,
} from "@vigil/core";
import { getVigilGraph } from "@vigil/graphs";

// GET /api/incidents — List all incidents for the active organization
export async function listIncidentsController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const rows = await listIncidents(orgId);
    res.json({ incidents: rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch incidents";
    res.status(500).json({ error: message });
  }
}

// GET /api/incidents/:id — Get a single incident with its approvals
export async function getIncidentByIdController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const incidentId = String(req.params.id ?? "");

    const [incident, approvals] = await Promise.all([
      getIncidentById(orgId, incidentId),
      listApprovalsForIncident(orgId, incidentId),
    ]);

    if (!incident) {
      res.status(404).json({ error: "Incident not found." });
      return;
    }

    res.json({ incident, approvals });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch incident";
    res.status(500).json({ error: message });
  }
}

// POST /api/incidents — Create incident & run Incident Investigation graph
export async function createIncidentController(req: Request, res: Response) {
  try {
    const {
      title,
      severity = "SEV-2",
      query,
      symptomSummary,
    } = req.body as {
      title?: string;
      severity?: Severity;
      query?: string;
      symptomSummary?: string;
    };

    if (!title || !title.trim()) {
      res.status(400).json({ error: "title is required." });
      return;
    }

    if (!SEVERITIES.includes(severity)) {
      res
        .status(400)
        .json({ error: "Invalid severity (SEV-1, SEV-2, SEV-3)." });
      return;
    }

    const { orgId, userId } = req.auth!;
    const threadId = `inc-${crypto.randomUUID()}`;

    const incident = await createIncident({
      orgId,
      threadId,
      title: title.trim(),
      severity,
      openedBy: userId,
    });

    const graph = await getVigilGraph();
    const state = await graph.invoke(
      {
        orgId,
        threadId,
        mode: "incident",
        incidentId: incident.id,
        severity,
        query: (query ?? symptomSummary ?? title).trim(),
      },
      {
        configurable: { thread_id: threadId },
      }
    );

    const updatedIncident = await getIncidentById(orgId, incident.id);

    res.status(201).json({
      incident: updatedIncident ?? incident,
      threadId,
      hypotheses: state.hypotheses,
      proposedAction: state.proposedAction,
      answer: state.answer,
      citations: state.citations,
      confidence: state.confidence,
      timeline: state.timeline,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start incident investigation";
    res.status(500).json({ error: message });
  }
}

// POST /api/incidents/:id/postmortem — Generate postmortem Markdown & action items
export async function generatePostmortemController(
  req: Request,
  res: Response
) {
  try {
    const { orgId } = req.auth!;
    const incidentId = String(req.params.id ?? "");

    const incident = await getIncidentById(orgId, incidentId);
    if (!incident) {
      res.status(404).json({ error: "Incident not found." });
      return;
    }

    const graph = await getVigilGraph();
    const state = await graph.invoke(
      {
        orgId,
        threadId: incident.threadId,
        mode: "postmortem",
        incidentId: incident.id,
        query: incident.title,
      },
      {
        configurable: { thread_id: incident.threadId },
      }
    );

    res.json({
      incidentId: incident.id,
      threadId: incident.threadId,
      postmortemMarkdown: state.postmortemMarkdown,
      actionItems: state.actionItems,
      timeline: state.timeline,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate postmortem";
    res.status(500).json({ error: message });
  }
}

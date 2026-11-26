import crypto from "node:crypto";
import type { Request, Response } from "express";
import {
  appendConversationMessage,
  createIncident,
  generateAndUpdateChatTitle,
  getIncidentById,
  getOrCreateConversation,
  listIncidents,
  SEVERITIES,
  updateIncidentStatus,
  type Severity,
} from "@vigil/core";
import { getVigilGraph } from "@vigil/graphs";

// GET /api/incidents — List all incidents / failure evaluations for the active organization
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

// GET /api/incidents/:id — Get a single incident
export async function getIncidentByIdController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const incidentId = String(req.params.id ?? "");

    const incident = await getIncidentById(orgId, incidentId);
    if (!incident) {
      res.status(404).json({ error: "Incident not found." });
      return;
    }

    res.json({ incident });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch incident";
    res.status(500).json({ error: message });
  }
}

// POST /api/incidents — Create incident, link/persist conversation, and run Failure Evaluation graph
export async function createIncidentController(req: Request, res: Response) {
  try {
    const {
      title,
      severity = "SEV-2",
      query,
      symptomSummary,
      conversationId: incomingConversationId,
    } = req.body as {
      title?: string;
      severity?: Severity;
      query?: string;
      symptomSummary?: string;
      conversationId?: string;
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
    const cleanPrompt = (query ?? symptomSummary ?? title).trim();
    const threadId = `inc-${crypto.randomUUID()}`;

    const incident = await createIncident({
      orgId,
      threadId,
      title: title.trim(),
      severity,
      openedBy: userId,
    });

    const conversation = await getOrCreateConversation({
      orgId,
      userId,
      conversationId: incomingConversationId,
      threadId,
      mode: "incident",
      incidentId: incident.id,
    });

    await appendConversationMessage({
      orgId,
      conversationId: conversation.id,
      role: "user",
      mode: "incident",
      content: cleanPrompt,
    });

    const graph = await getVigilGraph();
    const state = await graph.invoke(
      {
        orgId,
        threadId,
        incidentId: incident.id,
        severity,
        query: cleanPrompt,
      },
      {
        configurable: { thread_id: threadId },
      }
    );

    await updateIncidentStatus(orgId, incident.id, "monitoring");
    const updatedIncident = await getIncidentById(orgId, incident.id);

    const answer =
      state.answer ||
      "Evaluation completed. Review the ranked root-cause hypotheses and suggested fixes below.";

    await appendConversationMessage({
      orgId,
      conversationId: conversation.id,
      role: "assistant",
      mode: "incident",
      content: answer,
      confidence: state.confidence,
      grounded: true,
      metadata: {
        citations: state.citations,
        timeline: state.timeline,
        hypotheses: state.hypotheses,
        suggestedFixes: state.suggestedFixes,
      },
    });

    let chatTitle = conversation.title;
    if (
      !chatTitle ||
      chatTitle === "New chat" ||
      chatTitle === "New evaluation"
    ) {
      chatTitle = await generateAndUpdateChatTitle({
        orgId,
        conversationId: conversation.id,
        threadId,
        userMessage: cleanPrompt,
        assistantResponse: answer,
        mode: "incident",
      });
    }

    res.status(201).json({
      incident: updatedIncident ?? incident,
      conversationId: conversation.id,
      title: chatTitle,
      threadId,
      hypotheses: state.hypotheses,
      suggestedFixes: state.suggestedFixes,
      answer,
      citations: state.citations,
      confidence: state.confidence,
      timeline: state.timeline,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to run failure evaluation";
    res.status(500).json({ error: message });
  }
}

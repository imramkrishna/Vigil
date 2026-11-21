import crypto from "node:crypto";
import type { Request, Response } from "express";
import {
  appendConversationMessage,
  createIncident,
  generateAndUpdateChatTitle,
  getIncidentById,
  getOrCreateConversation,
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

// POST /api/incidents — Create incident, link/persist conversation, and run Incident Investigation graph
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
        mode: "incident",
        incidentId: incident.id,
        severity,
        query: cleanPrompt,
      },
      {
        configurable: { thread_id: threadId },
      }
    );

    const [updatedIncident, incidentApprovals] = await Promise.all([
      getIncidentById(orgId, incident.id),
      listApprovalsForIncident(orgId, incident.id),
    ]);

    const pendingApproval = incidentApprovals.find(
      (a) => a.decision === "pending"
    );
    const approvalId = pendingApproval?.id ?? null;
    const answer =
      state.answer || "Incident investigation paused at approval gate.";

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
        proposedAction: state.proposedAction,
        approvalId,
        approvalDecision: state.proposedAction ? "pending" : null,
      },
    });

    let chatTitle = conversation.title;
    if (!chatTitle || chatTitle === "New chat") {
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
      approvalId,
      threadId,
      hypotheses: state.hypotheses,
      proposedAction: state.proposedAction,
      answer,
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
    const { orgId, userId } = req.auth!;
    const incidentId = String(req.params.id ?? "");
    const { conversationId: incomingConversationId, query } = (req.body ??
      {}) as {
      conversationId?: string;
      query?: string;
    };

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

    let conversationId: string | null = null;
    let chatTitle: string | null = null;

    if (incomingConversationId || query) {
      const conversation = await getOrCreateConversation({
        orgId,
        userId,
        conversationId: incomingConversationId,
        mode: "postmortem",
        incidentId: incident.id,
      });
      conversationId = conversation.id;

      if (query?.trim()) {
        await appendConversationMessage({
          orgId,
          conversationId: conversation.id,
          role: "user",
          mode: "postmortem",
          content: query.trim(),
        });
      }

      const summaryText = `Generated blameless postmortem for **${incident.title}** (${incident.severity}).`;
      await appendConversationMessage({
        orgId,
        conversationId: conversation.id,
        role: "assistant",
        mode: "postmortem",
        content: summaryText,
        confidence: "high",
        grounded: true,
        metadata: {
          timeline: state.timeline,
          postmortemMarkdown: state.postmortemMarkdown,
          actionItems: state.actionItems,
        },
      });

      chatTitle = conversation.title;
      if (!chatTitle || chatTitle === "New chat") {
        chatTitle = await generateAndUpdateChatTitle({
          orgId,
          conversationId: conversation.id,
          threadId: conversation.threadId,
          userMessage: query?.trim() || `Postmortem: ${incident.title}`,
          assistantResponse: summaryText,
          mode: "postmortem",
        });
      }
    }

    res.json({
      incidentId: incident.id,
      conversationId,
      title: chatTitle,
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

import type { Request, Response } from "express";
import { Command } from "@langchain/langgraph";
import {
  decideApproval,
  listApprovals,
  type ApprovalDecision,
} from "@vigil/core";
import { getVigilGraph } from "@vigil/graphs";

// GET /api/approvals — List approvals for the active organization
export async function listApprovalsController(req: Request, res: Response) {
  try {
    const { orgId } = req.auth!;
    const decision = req.query.decision as ApprovalDecision | undefined;
    const rows = await listApprovals(orgId, decision);
    res.json({ approvals: rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch approvals";
    res.status(500).json({ error: message });
  }
}

// POST /api/approvals/:id/decide — Approve or reject a proposed remediation action & resume graph
export async function decideApprovalController(req: Request, res: Response) {
  try {
    const { decision } = req.body as {
      decision?: "approved" | "rejected";
    };

    if (decision !== "approved" && decision !== "rejected") {
      res
        .status(400)
        .json({ error: "decision must be 'approved' or 'rejected'." });
      return;
    }

    const { orgId, userId } = req.auth!;
    const approvalId = String(req.params.id ?? "");

    const updated = await decideApproval({
      orgId,
      approvalId,
      decision,
      decidedBy: userId,
    });

    if (!updated) {
      res.status(404).json({ error: "Approval not found." });
      return;
    }

    let executionResult: Record<string, unknown> | null = null;
    let answer = "";
    let timeline: string[] = [];

    if (updated.incident?.threadId) {
      const graph = await getVigilGraph();
      const state = await graph.invoke(
        new Command({ resume: { decision } }),
        {
          configurable: { thread_id: updated.incident.threadId },
        }
      );
      executionResult = state.executionResult;
      answer = state.answer;
      timeline = state.timeline;
    }

    res.json({
      approval: updated.approval,
      executionResult,
      answer,
      timeline,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process approval decision";
    res.status(500).json({ error: message });
  }
}

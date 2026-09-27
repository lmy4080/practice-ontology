import { tool } from "@openai/agents";
import { invokeAction } from "../shared/queryObjects.ts";

export const proposalApproveTool = tool({
  name: "proposal_approve",
  description: "Approve a sound Proposal and execute its underlying action.",
  parameters: {
    type: "object",
    properties: { proposal_id: { type: "string" }, decision_note: { type: "string" } },
    required: ["proposal_id"],
    additionalProperties: false,
  },
  strict: false,
  execute: (input) => {
    const { proposal_id, decision_note } = input as { proposal_id: string; decision_note?: string };
    return invokeAction({ type: "proposal", id: proposal_id, action: "approve", params: decision_note ? { decisionNote: decision_note } : {} });
  },
});

export const proposal_approve = proposalApproveTool;

export const proposalRejectTool = tool({
  name: "proposal_reject",
  description: "Reject a Proposal whose rationale or proposed action is not supported by the evidence.",
  parameters: {
    type: "object",
    properties: { proposal_id: { type: "string" }, decision_note: { type: "string" } },
    required: ["proposal_id"],
    additionalProperties: false,
  },
  strict: false,
  execute: (input) => {
    const { proposal_id, decision_note } = input as { proposal_id: string; decision_note?: string };
    return invokeAction({ type: "proposal", id: proposal_id, action: "reject", params: decision_note ? { decisionNote: decision_note } : {} });
  },
});

export const proposal_reject = proposalRejectTool;

export const proposalEscalateTool = tool({
  name: "proposal_escalate",
  description: "Escalate a Proposal with a concise note when material assumptions or evidence gaps require human review.",
  parameters: {
    type: "object",
    properties: { proposal_id: { type: "string" }, note: { type: "string", minLength: 1 } },
    required: ["proposal_id", "note"],
    additionalProperties: false,
  },
  strict: false,
  execute: (input) => {
    const { proposal_id, note } = input as { proposal_id: string; note: string };
    return invokeAction({ type: "proposal", id: proposal_id, action: "escalate", params: { note } });
  },
});

export const proposal_escalate = proposalEscalateTool;

import { tool } from "@openai/agents";
import { invokeAction } from "../shared/queryObjects.ts";

export const claimAutoApproveTool = tool({
  name: "claim_auto_approve",
  description: "Auto-approve a filed insurance claim when its policy, timing, documents, and cited coverage limit validate.",
  parameters: {
    type: "object",
    properties: {
      claimId: { type: "string" },
      reason: { type: "string", minLength: 1 },
      citedClauseIds: { type: "array", items: { type: "string" }, minItems: 1 },
      approvedAmount: { type: "number", exclusiveMinimum: 0 },
    },
    required: ["claimId", "reason", "citedClauseIds", "approvedAmount"],
    additionalProperties: false,
  },
  strict: false,
  execute: (input) => {
    const { claimId, reason, citedClauseIds, approvedAmount } = input as { claimId: string; reason: string; citedClauseIds: string[]; approvedAmount: number };
    return invokeAction({ type: "claim", id: claimId, action: "autoApprove", params: { reason, citedClauseIds, approvedAmount } });
  },
});

export const claim_auto_approve = claimAutoApproveTool;

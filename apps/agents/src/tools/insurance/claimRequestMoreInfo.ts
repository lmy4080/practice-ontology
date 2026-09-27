import { tool } from "@openai/agents";
import { createObject } from "../shared/queryObjects.ts";

export const proposeClaimRequestMoreInfoTool = tool({
  name: "propose_claim_request_more_info",
  description: "Create a human-review Proposal to request more information for an insurance claim.",
  parameters: {
    type: "object",
    properties: {
      claim_id: { type: "string" },
      reason: { type: "string", minLength: 1 },
      requested_info: { type: "string", minLength: 1 },
      rationale: { type: "string", minLength: 1 },
    },
    required: ["claim_id", "reason", "requested_info", "rationale"],
    additionalProperties: false,
  },
  strict: false,
  execute: async (input) => {
    const { claim_id, reason, requested_info, rationale } = input as { claim_id: string; reason: string; requested_info: string; rationale: string };
    const proposal = await createObject({
      type: "proposal",
      properties: {
        type: "claim.requestMoreInfo",
        targetId: claim_id,
        params: { reason, requestedInfo: requested_info },
        rationale,
        status: "pending",
        proposedBy: "claims-review-agent",
        proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
      },
    });
    return proposal.id;
  },
});

export const propose_claim_request_more_info = proposeClaimRequestMoreInfoTool;

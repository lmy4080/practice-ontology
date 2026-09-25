import { tool } from "@openai/agents";
import { createObject } from "../shared/queryObjects.ts";

export const proposeBatchCancelTool = tool({
  name: "propose_batch_cancel",
  description: "Propose cancelling a batch for human approval.",
  parameters: {
    type: "object",
    properties: {
      batch_id: { type: "string" },
      reason: { type: "string" },
      rationale: { type: "string" },
    },
    required: ["batch_id", "reason", "rationale"],
    additionalProperties: false,
  },
  strict: false,
  execute: async (input) => {
    const { batch_id, reason, rationale } = input as {
      batch_id: string;
      reason: string;
      rationale: string;
    };
    const proposal = await createObject({
      type: "proposal",
      properties: {
        type: "batch.cancel",
        targetId: batch_id,
        params: { reason },
        rationale,
        status: "pending",
        proposedBy: "ingredient-delivery-disruption-agent",
        proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
      },
    });
    return proposal.id;
  },
});

export const propose_batch_cancel = proposeBatchCancelTool;

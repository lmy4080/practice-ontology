import { tool } from "@openai/agents";
import { createObject } from "../shared/queryObjects.ts";

export const proposeBatchExtendRestTool = tool({
  name: "propose_batch_extend_rest",
  description: "Create a human-review Proposal to extend a fermenting or conditioning batch's rest when more time is safer than moving it early.",
  parameters: {
    type: "object",
    properties: { batch_id: { type: "string" }, additional_days: { type: "number" }, rationale: { type: "string" } },
    required: ["batch_id", "additional_days", "rationale"],
    additionalProperties: false,
  },
  strict: false,
  execute: async (input) => {
    const { batch_id, additional_days, rationale } = input as { batch_id: string; additional_days: number; rationale: string };
    const proposal = await createObject({
      type: "proposal",
      properties: {
        type: "batch.extendRest",
        targetId: batch_id,
        params: { additionalDays: additional_days },
        rationale,
        status: "pending",
        proposedBy: "planning-agent",
        proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
      },
    });
    return proposal.id;
  },
});

export const propose_batch_extend_rest = proposeBatchExtendRestTool;

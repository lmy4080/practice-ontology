import { tool } from "@openai/agents";
import { createObject } from "../shared/queryObjects.ts";

export const proposeBatchScheduleEarlyTransferTool = tool({
  name: "propose_batch_schedule_early_transfer",
  description: "Create a human-review Proposal to move a batch toward the next stage earlier when remaining in its current conditions is the risk; vessel availability is verified separately.",
  parameters: {
    type: "object",
    properties: { batch_id: { type: "string" }, planned_at: { type: "string", format: "date-time" }, rationale: { type: "string" } },
    required: ["batch_id", "planned_at", "rationale"],
    additionalProperties: false,
  },
  strict: false,
  execute: async (input) => {
    const { batch_id, planned_at, rationale } = input as { batch_id: string; planned_at: string; rationale: string };
    const proposal = await createObject({
      type: "proposal",
      properties: {
        type: "batch.scheduleEarlyTransfer",
        targetId: batch_id,
        params: { plannedAt: planned_at },
        rationale,
        status: "pending",
        proposedBy: "planning-agent",
        proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
      },
    });
    return proposal.id;
  },
});

export const propose_batch_schedule_early_transfer = proposeBatchScheduleEarlyTransferTool;

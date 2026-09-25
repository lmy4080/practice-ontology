import { tool } from "@openai/agents";
import { createObject, invokeAction } from "../shared/queryObjects.ts";

export const batchDeferStartTool = tool({
  name: "batch_defer_start",
  description: "Postpone a batch's planned start time.",
  parameters: {
    type: "object",
    properties: {
      batchId: { type: "string" },
      newPlannedStart: { type: "string", format: "date-time" },
    },
    required: ["batchId", "newPlannedStart"],
    additionalProperties: false,
  },
  strict: false,
  execute: (input) => {
    const { batchId, newPlannedStart } = input as { batchId: string; newPlannedStart: string };
    return invokeAction({
      type: "batch",
      id: batchId,
      action: "deferStart",
      params: { newPlannedStart },
    });
  },
});

export const batch_defer_start = batchDeferStartTool;

export const proposeBatchDeferStartTool = tool({
  name: "propose_batch_defer_start",
  description: "Propose deferring a batch's planned start time for human approval.",
  parameters: {
    type: "object",
    properties: {
      batch_id: { type: "string" },
      new_planned_start: { type: "string", format: "date-time" },
      rationale: { type: "string" },
    },
    required: ["batch_id", "new_planned_start", "rationale"],
    additionalProperties: false,
  },
  strict: false,
  execute: async (input) => {
    const { batch_id, new_planned_start, rationale } = input as {
      batch_id: string;
      new_planned_start: string;
      rationale: string;
    };
    const proposal = await createObject({
      type: "proposal",
      properties: {
        type: "batch.deferStart",
        targetId: batch_id,
        params: { newPlannedStart: new_planned_start },
        rationale,
        status: "pending",
        proposedBy: "ingredient-delivery-disruption-agent",
        proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
      },
    });
    return proposal.id;
  },
});

export const propose_batch_defer_start = proposeBatchDeferStartTool;

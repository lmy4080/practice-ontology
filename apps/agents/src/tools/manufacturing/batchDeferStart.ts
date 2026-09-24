import { tool } from "@openai/agents";
import { invokeAction } from "../shared/queryObjects.ts";

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

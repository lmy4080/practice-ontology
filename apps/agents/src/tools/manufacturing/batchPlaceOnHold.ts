import { tool } from "@openai/agents";
import { invokeAction } from "../shared/queryObjects.ts";

export const batchPlaceOnHoldTool = tool({
  name: "batch_place_on_hold",
  description: "Place a fermenting or conditioning batch on hold immediately when a confirmed contamination or safety stop requires it.",
  parameters: {
    type: "object",
    properties: { batchId: { type: "string" }, reason: { type: "string", minLength: 1 } },
    required: ["batchId", "reason"],
    additionalProperties: false,
  },
  strict: false,
  execute: (input) => {
    const { batchId, reason } = input as { batchId: string; reason: string };
    return invokeAction({ type: "batch", id: batchId, action: "placeOnHold", params: { reason } });
  },
});

export const batch_place_on_hold = batchPlaceOnHoldTool;

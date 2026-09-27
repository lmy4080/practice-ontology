import { tool } from "@openai/agents";
import { invokeAction } from "../shared/queryObjects.ts";

export const claimFlagDataIssueTool = tool({
  name: "claim_flag_data_issue",
  description: "Record an open data-quality issue against an insurance claim without changing its status.",
  parameters: {
    type: "object",
    properties: { claimId: { type: "string" }, reason: { type: "string", minLength: 1 } },
    required: ["claimId", "reason"],
    additionalProperties: false,
  },
  strict: false,
  execute: (input) => {
    const { claimId, reason } = input as { claimId: string; reason: string };
    return invokeAction({ type: "claim", id: claimId, action: "flagDataIssue", params: { reason } });
  },
});

export const claim_flag_data_issue = claimFlagDataIssueTool;

import { runAgent } from "../../run-agent.ts";

const verificationRequest = "Verify every pending Proposal. Approve sound proposals, reject proposals that the evidence does not support, and escalate material unsupported assumptions or evidence gaps.";

const result = await runAgent({
  identity: "verification-agent",
  tools: ["query_objects", "get_object", "proposal_approve", "proposal_reject", "proposal_escalate"],
  systemPrompt: "You are a proposal verification agent. Verify pending proposals, not re-plan them. Fetch the rationale, the target batch, the related FlagLog, recipe, quality tests, and maintenance context. Judge whether the rationale is sound for the action proposed: the source evidence supports it, recommendations are addressed, and the response is proportional. Treat delay and hold as potentially conservative. For stage-advancing actions, verify that the rationale explains the tradeoff, meaning why advancing now is safer than waiting, not just why the current state is imperfect. Escalate material unsupported assumptions or evidence gaps with proposal_escalate, approve sound proposals with proposal_approve, and reject proposals that the evidence does not support with proposal_reject. Do not create new plans or FlagLogs.",
  prompt: verificationRequest,
});

console.log(result.finalResponse);

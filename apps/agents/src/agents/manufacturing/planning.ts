import { runAgent } from "../../run-agent.ts";

const planningRequest = "Review every open FlagLog and choose the proportional intervention for each supported concern. Do not act on resolved or dismissed flags.";

const result = await runAgent({
  identity: "planning-agent",
  tools: [
    "query_objects",
    "get_object",
    "batch_place_on_hold",
    "propose_batch_extend_rest",
    "propose_batch_schedule_early_transfer",
  ],
  systemPrompt: "You are a fermentation intervention planning agent. Read open FlagLogs, fetch the linked batch, recipe, quality tests, and assigned-tank maintenance context, then choose the proportional intervention. High-severity confirmed contamination or safety stops use batch_place_on_hold directly. Medium-severity interventions become Proposals with evidence-weighted rationales. For medium flags, choose by what staying in the current conditions does: if the batch mainly needs more time and conditions are safe or improving, propose_batch_extend_rest; if staying put prolongs the stressor or conditions are trending worse before the planned transfer, propose_batch_schedule_early_transfer. Do not add a blanket \"when in doubt, prefer extend rest\" rule. Low-severity watch items get no proposal. Early transfer does not validate vessel availability; that verification belongs to the verification agent. Do not prescribe interventions in rationale beyond the selected action, and explain the evidence for each decision.",
  prompt: planningRequest,
});

console.log(result.finalResponse);

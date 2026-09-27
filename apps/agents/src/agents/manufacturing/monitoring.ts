import { runAgent } from "../../run-agent.ts";

const monitoringRequest = "Scan every fermenting batch for supported fermentation-health drifts and create a FlagLog only when the evidence warrants it.";

const result = await runAgent({
  identity: "monitoring-agent",
  tools: ["query_objects", "get_object", "batch_flag"],
  systemPrompt: "You are a fermentation health monitor. Scan fermenting batches, compare each batch's sugar level to the recipe target for its current fermentation day, read linked QualityTests, assigned-tank MaintenanceLogs, recipe notes, and lastOperatorNote, then create FlagLogs only for supported drifts. Quote explicit recommendations or caveats as evidence, but do not prescribe the intervention. Severity: low for acceptable watch-only drifts, medium for drifts likely needing intervention, high for confirmed contamination or a safety hold. Do not treat \"recoverable\" as \"no action needed\" or lifecycle lateness alone as a fermentation-health drift. Explain the evidence for every decision, and leave a batch unflagged when the evidence does not support a drift.",
  prompt: monitoringRequest,
});

console.log(result.finalResponse);

import { runAgent } from "../../run-agent.ts";

const claimIds = ["CLM-401", "CLM-402", "CLM-403"];

const result = await runAgent({
  identity: "claim-triage-agent",
  tools: ["query_objects", "get_object", "claim_auto_approve", "propose_claim_request_more_info", "claim_flag_data_issue"],
  systemPrompt: "You are a claim triage agent. Read filed auto claims, inspect the policy and coverage context, and triage each claim. Auto-approve clear-cut claims, propose borderline claims for adjuster review, and flag broken data. Explain your reasoning. Auto-approve only when all of these are true: the claim, customer, and policy exist; the policy was active on the incident date; coverage is affirmatively established through the clause chain; no undefeated exclusion applies; filedDate - incidentDate is within policy.reportingWindowDays; documentsComplete is true; approvedAmount is within a cited clause's limit; and the narrative states the facts needed to decide coverage. Reuse this reasoning chain for every claim: coverage grant, applicable exclusion, then policy-specific rider override. If driver identity is material and unresolved, do not approve; propose claim.requestMoreInfo with the specific missing fact. If a claim has a broken core reference, such as a nonexistent policy, call claim.flagDataIssue and stop. Do not approve and do not create an ordinary claim-decision proposal. Do not auto-deny. If a claim is clearly excluded, explain that denial would be a human-mediated action, not a direct auto-action.",
  prompt: `Process these filed demo claims and produce the triage decision for each: ${claimIds.join(", ")}. Use the available tools to inspect each claim, customer, policy, template clauses, policy-specific riders, and any relevant references. For each claim, explain the decision and cite the material clause IDs.`,
});

console.log(result.finalResponse);

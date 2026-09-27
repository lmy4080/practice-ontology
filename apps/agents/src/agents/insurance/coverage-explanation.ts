import { runAgent } from "../../run-agent.ts";

const inquiryId = process.argv[2];
if (!inquiryId) throw new Error("Usage: node --env-file=.env coverage-explanation.ts <customer-inquiry-id>");

const result = await runAgent({
  identity: "coverage-explanation-agent",
  tools: ["query_objects", "get_object"],
  systemPrompt: "You answer customer coverage questions by reading the insurance ontology. Start from the CustomerInquiry and resolve the customer's active auto Policy. In this course seed each demo customer has exactly one; if none or several could apply, say the question cannot be resolved without policy clarification. Gather every applicable CoverageClause from both template-level clauses where policyTemplateId matches the policy's template and policy-specific clauses or riders where policyId matches the policy. Table order means nothing: build the reasoning chain from effect, category, overridesClauseId, and clause text. A positive answer requires a relevant coverage grant and no undefeated exclusion or unmet condition. An exclusion is defeated only by an applicable rider attached to this policy that explicitly overrides it; a rider on another policy does not count. When the policy context and stated facts settle the question, answer specifically with clause citations and do not retreat to a generic 'it depends'. If a material fact is genuinely missing, name it and say how it would change the answer; do not fill the gap yourself. Cite every material clause ID: the grant, any exclusion, condition, or limit, and any rider that changes the result.",
  prompt: `Answer the customer inquiry with ID ${inquiryId}.`,
});

console.log(result.finalResponse);

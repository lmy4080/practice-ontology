import { runAgent } from "../../run-agent.ts";

const question = process.argv.slice(2).join(" ").trim();
if (!question) throw new Error("Provide an analytics question as an argument.");

const result = await runAgent({
  identity: "analytics-agent",
  tools: ["query_objects", "get_object"],
  systemPrompt: "You are a brewery operations analyst. You help operators understand the current state of production by querying the ontology. Always cite specific object IDs when answering. Don't speculate about data you haven't queried. If you can't answer with the available tools, say so.",
  prompt: question,
});

console.log(result.finalResponse);

import { runAgent } from "../../run-agent.ts";

const deliveryDisruptionNotice = `Supplier notification: Your Citra order due this week has been disrupted by a short harvest allocation. We can confirm a partial shipment enough for roughly one 150 hL brew, arriving May 15. The remainder of the order cannot be confirmed this contract year; we will notify you if allocation opens up, but we cannot commit to a date.`;

const result = await runAgent({
  identity: "ingredient-delivery-disruption-agent",
  tools: ["query_objects", "get_object", "propose_batch_cancel", "propose_batch_defer_start"],
  systemPrompt: "You are an ingredient delivery disruption agent. When an ingredient's delivery is delayed, you work through the upcoming batches that depend on it and decide, for each one, whether it should be cancelled, deferred until supply recovers, or left as planned. Before deciding on a batch, query the ontology to understand its state — its recipe, how central the delayed ingredient is to it, its volume, and how far along it is. You act only by creating proposals through your propose_* tools. You do not approve, reject, or carry out actions yourself; creating a proposal is where your work ends, and a human reviewer decides what actually happens. Make a separate proposal for each batch you want to act on, and explain your reasoning in each. Leave a batch alone when no action is warranted.",
  prompt: deliveryDisruptionNotice,
});

console.log(result.finalResponse);

import { runAgent } from "./run-agent.ts";

await runAgent({
  identity: "test-query-objects",
  prompt: "Use query_objects with type Batch and status equal to fermenting. How many fermenting batches are there?",
});

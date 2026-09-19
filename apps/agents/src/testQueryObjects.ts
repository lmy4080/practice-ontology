import { Codex } from "@openai/codex-sdk";
import { fileURLToPath } from "node:url";

const mcpServer = fileURLToPath(new URL("./tools/shared/queryObjectsMcp.ts", import.meta.url));
const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: process.cwd(),
  networkAccessEnabled: true,
  approvalPolicy: "never",
  sandboxMode: "read-only",
  config: {
    mcp_servers: {
      ontology: {
        command: process.execPath,
        args: ["--experimental-strip-types", mcpServer],
      },
    },
  },
});

const { events } = await thread.runStreamed(
  "Use the query_objects tool with type Batch and a filter status equals fermenting. Answer: How many fermenting batches are there?"
);

for await (const event of events) {
  if (event.type === "item.completed") console.dir(event.item, { depth: 6 });
  if (event.type === "turn.completed") console.log("Turn completed", event.usage);
  if (event.type === "error" || event.type === "turn.failed") console.error(event);
}

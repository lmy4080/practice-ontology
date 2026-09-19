import { queryObjects, type QueryObjectsInput } from "./queryObjects.ts";
import { createInterface } from "node:readline";

const tool = {
  name: "query_objects",
  description: "Query ontology objects by API type with optional property filters.",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", description: "The Object type API name, such as Batch." },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            property: { type: "string" },
            op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "isNull", "isNotNull"] },
            value: {},
          },
          required: ["property", "op"],
          additionalProperties: false,
        },
      },
      limit: { type: "number" },
    },
    required: ["type"],
    additionalProperties: false,
  },
};

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of input) {
  if (!line.trim()) continue;
  const request = JSON.parse(line);
  if (request.method === "notifications/initialized") continue;

  let result;
  if (request.method === "initialize") {
    result = {
      protocolVersion: request.params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "fde-ontology", version: "1.0.0" },
    };
  } else if (request.method === "tools/list") {
    result = { tools: [tool] };
  } else if (request.method === "tools/call" && request.params?.name === tool.name) {
    try {
      const text = await queryObjects(request.params.arguments as QueryObjectsInput);
      result = { content: [{ type: "text", text }] };
    } catch (error) {
      result = { content: [{ type: "text", text: String(error) }], isError: true };
    }
  } else {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" }})}\n`);
    continue;
  }

  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
}

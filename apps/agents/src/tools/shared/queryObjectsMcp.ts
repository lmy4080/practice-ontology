import { getObject, invokeAction, queryObjects, type GetObjectInput, type QueryObjectsInput } from "./queryObjects.ts";
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

const getObjectTool = {
  name: "get_object",
  description: "Get one ontology object by type and ID.",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", description: "The Object type API name, such as Batch." },
      id: { type: "string", description: "The object ID, such as B-2105." },
    },
    required: ["type", "id"],
    additionalProperties: false,
  },
};

const batchDeferStartTool = {
  name: "batch_defer_start",
  description: "Postpone a batch's planned start time.",
  inputSchema: {
    type: "object",
    properties: {
      batchId: { type: "string" },
      newPlannedStart: { type: "string", format: "date-time" },
    },
    required: ["batchId", "newPlannedStart"],
    additionalProperties: false,
  },
};

const tankScheduleMaintenanceTool = {
  name: "tank_schedule_maintenance",
  description: "Schedule maintenance and take the tank offline.",
  inputSchema: {
    type: "object",
    properties: {
      tankId: { type: "string" },
      type: { type: "string", enum: ["inspection", "preventive", "corrective", "cleaning"] },
      plannedAt: { type: "string", format: "date-time" },
      notes: { type: "string" },
    },
    required: ["tankId", "type", "plannedAt", "notes"],
    additionalProperties: false,
  },
};

const tools = [tool, getObjectTool, batchDeferStartTool, tankScheduleMaintenanceTool];

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
    result = { tools };
  } else if (request.method === "tools/call" && tools.some((candidate) => candidate.name === request.params?.name)) {
    try {
      const text = request.params.name === tool.name
        ? await queryObjects(request.params.arguments as QueryObjectsInput)
        : request.params.name === getObjectTool.name
          ? await getObject(request.params.arguments as GetObjectInput)
          : request.params.name === batchDeferStartTool.name
            ? await invokeAction({
                type: "batch",
                id: (request.params.arguments as { batchId: string }).batchId,
                action: "deferStart",
                params: { newPlannedStart: (request.params.arguments as { newPlannedStart: string }).newPlannedStart },
              })
            : await invokeAction({
                type: "tank",
                id: (request.params.arguments as { tankId: string }).tankId,
                action: "scheduleMaintenance",
                params: request.params.arguments as { type: string; plannedAt: string; notes: string },
              });
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

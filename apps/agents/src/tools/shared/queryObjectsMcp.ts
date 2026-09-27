import { createObject, getObject, invokeAction, queryObjects, type CreateObjectInput, type GetObjectInput, type QueryObjectsInput } from "./queryObjects.ts";
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

const batchFlagTool = {
  name: "batch_flag",
  description: "Record a supported fermentation-health concern without changing the batch status.",
  inputSchema: {
    type: "object",
    properties: {
      batchId: { type: "string" },
      reason: { type: "string", minLength: 1 },
      severity: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: ["batchId", "reason", "severity"],
    additionalProperties: false,
  },
};

const claimAutoApproveTool = {
  name: "claim_auto_approve",
  description: "Auto-approve a filed insurance claim when its policy, timing, documents, and cited coverage limit validate.",
  inputSchema: {
    type: "object",
    properties: { claimId: { type: "string" }, reason: { type: "string", minLength: 1 }, citedClauseIds: { type: "array", items: { type: "string" }, minItems: 1 }, approvedAmount: { type: "number", exclusiveMinimum: 0 } },
    required: ["claimId", "reason", "citedClauseIds", "approvedAmount"],
    additionalProperties: false,
  },
};

const proposeClaimRequestMoreInfoTool = {
  name: "propose_claim_request_more_info",
  description: "Create a human-review Proposal to request more information for an insurance claim.",
  inputSchema: {
    type: "object",
    properties: { claim_id: { type: "string" }, reason: { type: "string", minLength: 1 }, requested_info: { type: "string", minLength: 1 }, rationale: { type: "string", minLength: 1 } },
    required: ["claim_id", "reason", "requested_info", "rationale"],
    additionalProperties: false,
  },
};

const claimFlagDataIssueTool = {
  name: "claim_flag_data_issue",
  description: "Record an open data-quality issue against an insurance claim without changing its status.",
  inputSchema: {
    type: "object",
    properties: { claimId: { type: "string" }, reason: { type: "string", minLength: 1 } },
    required: ["claimId", "reason"],
    additionalProperties: false,
  },
};

const batchPlaceOnHoldTool = {
  name: "batch_place_on_hold",
  description: "Place a fermenting or conditioning batch on hold immediately for a confirmed contamination or safety stop.",
  inputSchema: {
    type: "object",
    properties: { batchId: { type: "string" }, reason: { type: "string", minLength: 1 } },
    required: ["batchId", "reason"],
    additionalProperties: false,
  },
};

const proposeBatchExtendRestTool = {
  name: "propose_batch_extend_rest",
  description: "Create a human-review Proposal to extend rest when more time is safer than moving a batch early.",
  inputSchema: {
    type: "object",
    properties: { batch_id: { type: "string" }, additional_days: { type: "number" }, rationale: { type: "string" } },
    required: ["batch_id", "additional_days", "rationale"],
    additionalProperties: false,
  },
};

const proposeBatchScheduleEarlyTransferTool = {
  name: "propose_batch_schedule_early_transfer",
  description: "Create a human-review Proposal to move a batch toward the next stage earlier when staying in current conditions is the risk; vessel availability is verified separately.",
  inputSchema: {
    type: "object",
    properties: { batch_id: { type: "string" }, planned_at: { type: "string", format: "date-time" }, rationale: { type: "string" } },
    required: ["batch_id", "planned_at", "rationale"],
    additionalProperties: false,
  },
};

const proposalApproveTool = {
  name: "proposal_approve",
  description: "Approve a sound Proposal and execute its underlying action.",
  inputSchema: {
    type: "object",
    properties: { proposal_id: { type: "string" }, decision_note: { type: "string" } },
    required: ["proposal_id"],
    additionalProperties: false,
  },
};

const proposalRejectTool = {
  name: "proposal_reject",
  description: "Reject a Proposal whose rationale or proposed action is not supported by the evidence.",
  inputSchema: {
    type: "object",
    properties: { proposal_id: { type: "string" }, decision_note: { type: "string" } },
    required: ["proposal_id"],
    additionalProperties: false,
  },
};

const proposalEscalateTool = {
  name: "proposal_escalate",
  description: "Escalate a Proposal with a concise note when material assumptions or evidence gaps require human review.",
  inputSchema: {
    type: "object",
    properties: { proposal_id: { type: "string" }, note: { type: "string", minLength: 1 } },
    required: ["proposal_id", "note"],
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

const proposeBatchCancelTool = {
  name: "propose_batch_cancel",
  description: "Propose cancelling a batch for human approval.",
  inputSchema: {
    type: "object",
    properties: {
      batch_id: { type: "string" },
      reason: { type: "string" },
      rationale: { type: "string" },
    },
    required: ["batch_id", "reason", "rationale"],
    additionalProperties: false,
  },
};

const proposeBatchDeferStartTool = {
  name: "propose_batch_defer_start",
  description: "Propose deferring a batch's planned start time for human approval.",
  inputSchema: {
    type: "object",
    properties: {
      batch_id: { type: "string" },
      new_planned_start: { type: "string", format: "date-time" },
      rationale: { type: "string" },
    },
    required: ["batch_id", "new_planned_start", "rationale"],
    additionalProperties: false,
  },
};

const tools = [tool, getObjectTool, claimAutoApproveTool, proposeClaimRequestMoreInfoTool, claimFlagDataIssueTool, batchDeferStartTool, batchFlagTool, batchPlaceOnHoldTool, proposeBatchExtendRestTool, proposeBatchScheduleEarlyTransferTool, proposalApproveTool, proposalRejectTool, proposalEscalateTool, tankScheduleMaintenanceTool, proposeBatchCancelTool, proposeBatchDeferStartTool];

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
          : request.params.name === claimAutoApproveTool.name
            ? await invokeAction({
                type: "claim",
                id: (request.params.arguments as { claimId: string }).claimId,
                action: "autoApprove",
                params: {
                  reason: (request.params.arguments as { reason: string }).reason,
                  citedClauseIds: (request.params.arguments as { citedClauseIds: string[] }).citedClauseIds,
                  approvedAmount: (request.params.arguments as { approvedAmount: number }).approvedAmount,
                },
              })
            : request.params.name === proposeClaimRequestMoreInfoTool.name
              ? String((await createObject({
                  type: "proposal",
                  properties: {
                    type: "claim.requestMoreInfo",
                    targetId: (request.params.arguments as { claim_id: string }).claim_id,
                    params: {
                      reason: (request.params.arguments as { reason: string }).reason,
                      requestedInfo: (request.params.arguments as { requested_info: string }).requested_info,
                    },
                    rationale: (request.params.arguments as { rationale: string }).rationale,
                    status: "pending",
                    proposedBy: "claims-review-agent",
                    proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
                  },
                } as CreateObjectInput)).id)
              : request.params.name === claimFlagDataIssueTool.name
                ? await invokeAction({
                    type: "claim",
                    id: (request.params.arguments as { claimId: string }).claimId,
                    action: "flagDataIssue",
                    params: { reason: (request.params.arguments as { reason: string }).reason },
                  })
          : request.params.name === batchDeferStartTool.name
          ? await invokeAction({
                type: "batch",
                id: (request.params.arguments as { batchId: string }).batchId,
                action: "deferStart",
                params: { newPlannedStart: (request.params.arguments as { newPlannedStart: string }).newPlannedStart },
              })
            : request.params.name === batchFlagTool.name
              ? await invokeAction({
                  type: "batch",
                  id: (request.params.arguments as { batchId: string }).batchId,
                  action: "flag",
                  params: {
                    reason: (request.params.arguments as { reason: string }).reason,
                    severity: (request.params.arguments as { severity: string }).severity,
                  },
                })
            : request.params.name === batchPlaceOnHoldTool.name
              ? await invokeAction({
                  type: "batch",
                  id: (request.params.arguments as { batchId: string }).batchId,
                  action: "placeOnHold",
                  params: { reason: (request.params.arguments as { reason: string }).reason },
                })
            : request.params.name === proposeBatchExtendRestTool.name
              ? String((await createObject({
                  type: "proposal",
                  properties: {
                    type: "batch.extendRest",
                    targetId: (request.params.arguments as { batch_id: string }).batch_id,
                    params: { additionalDays: (request.params.arguments as { additional_days: number }).additional_days },
                    rationale: (request.params.arguments as { rationale: string }).rationale,
                    status: "pending",
                    proposedBy: "planning-agent",
                    proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
                  },
                } as CreateObjectInput)).id)
              : request.params.name === proposeBatchScheduleEarlyTransferTool.name
                ? String((await createObject({
                    type: "proposal",
                    properties: {
                      type: "batch.scheduleEarlyTransfer",
                      targetId: (request.params.arguments as { batch_id: string }).batch_id,
                      params: { plannedAt: (request.params.arguments as { planned_at: string }).planned_at },
                      rationale: (request.params.arguments as { rationale: string }).rationale,
                      status: "pending",
                      proposedBy: "planning-agent",
                      proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
                    },
                  } as CreateObjectInput)).id)
                : request.params.name === proposalApproveTool.name
                  ? await invokeAction({
                      type: "proposal",
                      id: (request.params.arguments as { proposal_id: string }).proposal_id,
                      action: "approve",
                      params: (request.params.arguments as { decision_note?: string }).decision_note
                        ? { decisionNote: (request.params.arguments as { decision_note: string }).decision_note }
                        : {},
                    })
                : request.params.name === proposalRejectTool.name
                  ? await invokeAction({
                      type: "proposal",
                      id: (request.params.arguments as { proposal_id: string }).proposal_id,
                      action: "reject",
                      params: (request.params.arguments as { decision_note?: string }).decision_note
                        ? { decisionNote: (request.params.arguments as { decision_note: string }).decision_note }
                        : {},
                    })
                : request.params.name === proposalEscalateTool.name
                  ? await invokeAction({
                      type: "proposal",
                      id: (request.params.arguments as { proposal_id: string }).proposal_id,
                      action: "escalate",
                      params: { note: (request.params.arguments as { note: string }).note },
                    })
            : request.params.name === proposeBatchCancelTool.name
              ? String((await createObject({
                  type: "proposal",
                  properties: {
                    type: "batch.cancel",
                    targetId: (request.params.arguments as { batch_id: string }).batch_id,
                    params: { reason: (request.params.arguments as { reason: string }).reason },
                    rationale: (request.params.arguments as { rationale: string }).rationale,
                    status: "pending",
                    proposedBy: "ingredient-delivery-disruption-agent",
                    proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
                  },
                } as CreateObjectInput)).id)
              : request.params.name === proposeBatchDeferStartTool.name
                ? String((await createObject({
                    type: "proposal",
                    properties: {
                      type: "batch.deferStart",
                      targetId: (request.params.arguments as { batch_id: string }).batch_id,
                      params: { newPlannedStart: (request.params.arguments as { new_planned_start: string }).new_planned_start },
                      rationale: (request.params.arguments as { rationale: string }).rationale,
                      status: "pending",
                      proposedBy: "ingredient-delivery-disruption-agent",
                      proposedAt: new Date(process.env.COURSE_NOW ?? Date.now()).toISOString(),
                    },
                  } as CreateObjectInput)).id)
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

import { tool } from "@openai/agents";
import { invokeAction } from "../shared/queryObjects.ts";

export const tankScheduleMaintenanceTool = tool({
  name: "tank_schedule_maintenance",
  description: "Schedule maintenance and take the tank offline.",
  parameters: {
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
  strict: false,
  execute: (input) => {
    const { tankId, type, plannedAt, notes } = input as {
      tankId: string;
      type: "inspection" | "preventive" | "corrective" | "cleaning";
      plannedAt: string;
      notes: string;
    };
    return invokeAction({
      type: "tank",
      id: tankId,
      action: "scheduleMaintenance",
      params: { type, plannedAt, notes },
    });
  },
});

export const tank_schedule_maintenance = tankScheduleMaintenanceTool;

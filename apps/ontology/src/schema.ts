import type { ActionContext } from "./actions/manufacturing/batchDeferStart.ts";
import { batchCancel } from "./actions/manufacturing/batchCancel.ts";
import { batchDeferStart } from "./actions/manufacturing/batchDeferStart.ts";
import { tankScheduleMaintenance } from "./actions/manufacturing/tankScheduleMaintenance.ts";
import { proposalApprove, proposalReject } from "./actions/shared/proposal.ts";
import type { Database } from "./db.ts";

export type ActionHandler = (instance: unknown, params: unknown | undefined, context: ActionContext) => Promise<unknown>;

export const actionHandlers: Record<string, ActionHandler> = {
  "batch.cancel": (instance, params, context) =>
    batchCancel(instance as Database["manufacturing.batch"], params as { reason: string }, context),
  "batch.deferStart": (instance, params, context) =>
    batchDeferStart(instance as Database["manufacturing.batch"], params as { newPlannedStart: string }, context),
  "tank.scheduleMaintenance": (instance, params, context) =>
    tankScheduleMaintenance(instance as Database["manufacturing.tank"], params as { type: string; plannedAt: string; notes: string }, context),
  "proposal.approve": (instance, params, context) =>
    proposalApprove(instance as Database["manufacturing.proposal"], params as { decisionNote?: string }, context),
  "proposal.reject": (instance, params, context) =>
    proposalReject(instance as Database["manufacturing.proposal"], params as { decisionNote?: string }, context),
};

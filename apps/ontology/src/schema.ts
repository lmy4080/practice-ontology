import type { ActionContext } from "./actions/manufacturing/batchDeferStart.ts";
import { batchCancel } from "./actions/manufacturing/batchCancel.ts";
import { batchDeferStart } from "./actions/manufacturing/batchDeferStart.ts";
import { tankScheduleMaintenance } from "./actions/manufacturing/tankScheduleMaintenance.ts";
import { batchFlag } from "./actions/manufacturing/batchFlag.ts";
import { batchPlaceOnHold } from "./actions/manufacturing/batchPlaceOnHold.ts";
import { batchExtendRest } from "./actions/manufacturing/batchExtendRest.ts";
import { batchScheduleEarlyTransfer } from "./actions/manufacturing/batchScheduleEarlyTransfer.ts";
import { proposalApprove, proposalReject, proposalEscalate } from "./actions/shared/proposal.ts";
import type { Database } from "./db.ts";

export type ActionHandler = (instance: unknown, params: unknown | undefined, context: ActionContext) => Promise<unknown>;

export const actionHandlers: Record<string, ActionHandler> = {
  "batch.cancel": (instance, params, context) =>
    batchCancel(instance as Database["manufacturing.batch"], params as { reason: string }, context),
  "batch.deferStart": (instance, params, context) =>
    batchDeferStart(instance as Database["manufacturing.batch"], params as { newPlannedStart: string }, context),
  "tank.scheduleMaintenance": (instance, params, context) =>
    tankScheduleMaintenance(instance as Database["manufacturing.tank"], params as { type: string; plannedAt: string; notes: string }, context),
  "batch.flag": (instance, params, context) =>
    batchFlag(instance as Database["manufacturing.batch"], params as { reason: string; severity: string }, context),
  "batch.placeOnHold": (instance, params, context) =>
    batchPlaceOnHold(instance as Database["manufacturing.batch"], params as { reason: string }, context),
  "batch.extendRest": (instance, params, context) =>
    batchExtendRest(instance as Database["manufacturing.batch"], params as { additionalDays: number }, context),
  "batch.scheduleEarlyTransfer": (instance, params, context) =>
    batchScheduleEarlyTransfer(instance as Database["manufacturing.batch"], params as { plannedAt: string }, context),
  "proposal.approve": (instance, params, context) =>
    proposalApprove(instance as Database["manufacturing.proposal"], params as { decisionNote?: string }, context),
  "proposal.reject": (instance, params, context) =>
    proposalReject(instance as Database["manufacturing.proposal"], params as { decisionNote?: string }, context),
  "proposal.escalate": (instance, params, context) =>
    proposalEscalate(instance as Database["manufacturing.proposal"], params as { note: string }, context),
};

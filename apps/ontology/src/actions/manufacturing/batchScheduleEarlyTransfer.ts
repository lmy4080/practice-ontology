import type { BatchTable } from "../../db.ts";
import { actionTransaction, type ActionContext } from "./batchDeferStart.ts";

export async function batchScheduleEarlyTransfer(
  batch: BatchTable,
  params: { plannedAt: string },
  context: ActionContext,
): Promise<BatchTable> {
  if (batch.status !== "fermenting" && batch.status !== "conditioning") {
    throw new Error(`Batch ${batch.id} cannot be transferred early while status is ${batch.status}; it must be fermenting or conditioning.`);
  }
  const plannedAt = new Date(params.plannedAt);
  if (!Number.isFinite(plannedAt.getTime()) || plannedAt.getTime() <= Date.now()) {
    throw new Error("plannedAt must be a valid date in the future.");
  }
  if (!batch.planned_transfer_at || plannedAt.getTime() >= new Date(batch.planned_transfer_at).getTime()) {
    throw new Error("plannedAt must be earlier than the current planned transfer.");
  }

  return actionTransaction(context, async (trx) => {
    const updated = await trx
      .updateTable("manufacturing.batch")
      .set({ planned_transfer_at: plannedAt })
      .where("id", "=", batch.id)
      .where("status", "in", ["fermenting", "conditioning"])
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx.withSchema("manufacturing").insertInto("audit_log").values({
      action_type_id: context.actionType.id,
      action_api_name: context.actionType.api_name,
      target_type_id: context.objectType.id,
      target_type_api_name: context.objectType.api_name,
      target_id: batch.id,
      actor: context.callerIdentity ?? context.actor,
      params,
      result: updated,
      ...(context.authorizedByProposal ? { authorized_by_proposal: context.authorizedByProposal } : {}),
    }).execute();

    return updated;
  });
}

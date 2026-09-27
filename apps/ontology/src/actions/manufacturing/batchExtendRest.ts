import type { BatchTable } from "../../db.ts";
import { actionTransaction, type ActionContext } from "./batchDeferStart.ts";

export async function batchExtendRest(
  batch: BatchTable,
  params: { additionalDays: number },
  context: ActionContext,
): Promise<BatchTable> {
  if (batch.status !== "fermenting" && batch.status !== "conditioning") {
    throw new Error(`Batch ${batch.id} cannot have its rest extended while status is ${batch.status}; it must be fermenting or conditioning.`);
  }
  if (!Number.isInteger(params.additionalDays) || params.additionalDays <= 0) {
    throw new Error("additionalDays must be a positive integer.");
  }
  if (!batch.planned_transfer_at) throw new Error(`Batch ${batch.id} has no planned transfer date to extend.`);

  const plannedTransfer = new Date(batch.planned_transfer_at);
  plannedTransfer.setUTCDate(plannedTransfer.getUTCDate() + params.additionalDays);

  return actionTransaction(context, async (trx) => {
    const updated = await trx
      .updateTable("manufacturing.batch")
      .set({ planned_transfer_at: plannedTransfer })
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

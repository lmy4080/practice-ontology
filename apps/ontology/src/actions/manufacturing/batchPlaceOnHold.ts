import type { BatchTable } from "../../db.ts";
import { actionTransaction, type ActionContext } from "./batchDeferStart.ts";

export async function batchPlaceOnHold(
  batch: BatchTable,
  params: { reason: string },
  context: ActionContext,
): Promise<BatchTable> {
  if (batch.status !== "fermenting" && batch.status !== "conditioning") {
    throw new Error(`Batch ${batch.id} cannot be placed on hold while status is ${batch.status}; it must be fermenting or conditioning.`);
  }
  if (!params.reason.trim()) throw new Error("reason must not be empty.");

  return actionTransaction(context, async (trx) => {
    const updated = await trx
      .updateTable("manufacturing.batch")
      .set({ status: "onHold" })
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

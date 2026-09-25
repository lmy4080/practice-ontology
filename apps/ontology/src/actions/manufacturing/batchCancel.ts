import type { BatchTable } from "../../db.ts";
import type { ActionContext } from "./batchDeferStart.ts";

export async function batchCancel(
  batch: BatchTable,
  params: { reason: string },
  context: ActionContext,
): Promise<BatchTable> {
  if (batch.status !== "queued" && batch.status !== "fermenting") {
    throw new Error(`Batch ${batch.id} cannot be cancelled while status is ${batch.status}; it must be queued or fermenting.`);
  }

  return context.db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable("manufacturing.batch")
      .set({ status: "cancelled" })
      .where("id", "=", batch.id)
      .where("status", "in", ["queued", "fermenting"])
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .withSchema("manufacturing")
      .insertInto("audit_log")
      .values({
        action_type_id: context.actionType.id,
        action_api_name: context.actionType.api_name,
        target_type_id: context.objectType.id,
        target_type_api_name: context.objectType.api_name,
        target_id: batch.id,
        actor: context.actor,
        params,
        result: updated,
      })
      .execute();

    return updated;
  });
}

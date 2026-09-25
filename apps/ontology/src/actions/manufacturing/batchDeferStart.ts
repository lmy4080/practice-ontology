import type { Kysely } from "kysely";

import type { ActionTypeTable, BatchTable, Database, ObjectTypeTable } from "../../db.ts";

export interface ActionContext {
  db: Kysely<Database>;
  actor: string;
  callerIdentity?: string;
  objectType: ObjectTypeTable;
  actionType: ActionTypeTable;
  authorizedByProposal?: string;
}

export function actionTransaction<T>(context: ActionContext, callback: (db: Kysely<Database>) => Promise<T>) {
  return context.db.isTransaction
    ? callback(context.db)
    : context.db.transaction().execute((trx) => callback(trx as unknown as Kysely<Database>));
}

export async function batchDeferStart(
  batch: BatchTable,
  params: { newPlannedStart: string },
  context: ActionContext,
): Promise<BatchTable> {
  const plannedStart = new Date(params.newPlannedStart);
  if (batch.status !== "queued") {
    throw new Error(`Batch ${batch.id} cannot be deferred while status is ${batch.status}; it must be queued.`);
  }
  if (!Number.isFinite(plannedStart.getTime()) || plannedStart.getTime() <= Date.now()) {
    throw new Error("newPlannedStart must be a valid date in the future.");
  }

  return actionTransaction(context, async (trx) => {
    const updated = await trx
      .updateTable("manufacturing.batch")
      .set({ planned_start: plannedStart })
      .where("id", "=", batch.id)
      .where("status", "=", "queued")
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
        actor: context.callerIdentity ?? "system",
        params,
        result: updated,
        ...(context.authorizedByProposal ? { authorized_by_proposal: context.authorizedByProposal } : {}),
      })
      .execute();

    return updated;
  });
}

import type { BatchTable, FlagLogTable } from "../../db.ts";
import { actionTransaction, type ActionContext } from "./batchDeferStart.ts";

const severities = new Set(["low", "medium", "high"]);

export async function batchFlag(
  batch: BatchTable,
  params: { reason: string; severity: string },
  context: ActionContext,
): Promise<FlagLogTable> {
  if (!params.reason.trim()) throw new Error("reason must not be empty.");
  if (!severities.has(params.severity)) throw new Error("severity must be low, medium, or high.");

  return actionTransaction(context, async (trx) => {
    const flag = await trx
      .insertInto("manufacturing.flag_log")
      .values({
        id: `FL-${batch.id}-${Date.now()}`,
        batch_id: batch.id,
        reason: params.reason,
        severity: params.severity,
        status: "open",
        flagged_by: context.callerIdentity ?? context.actor,
        flagged_at: new Date(),
        resolved_at: null,
      })
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
        actor: context.callerIdentity ?? context.actor,
        params,
        result: flag,
        ...(context.authorizedByProposal ? { authorized_by_proposal: context.authorizedByProposal } : {}),
      })
      .execute();

    return flag;
  });
}

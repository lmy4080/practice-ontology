import type { ClaimTable } from "../../db.ts";
import { actionTransaction, type ActionContext } from "../manufacturing/batchDeferStart.ts";

export async function claimRequestMoreInfo(
  claim: ClaimTable,
  params: { reason: string; requestedInfo: string },
  context: ActionContext,
): Promise<ClaimTable> {
  if (claim.status !== "filed") throw new Error(`Claim ${claim.id} cannot request more information while status is ${claim.status}; it must be filed.`);
  if (!params.reason.trim() || !params.requestedInfo.trim()) throw new Error("reason and requestedInfo must not be empty.");

  return actionTransaction(context, async (trx) => {
    const updated = await trx
      .updateTable("insurance.claim")
      .set({ status: "pendingReview" })
      .where("id", "=", claim.id)
      .where("status", "=", "filed")
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx.withSchema("insurance").insertInto("audit_log").values({
      action_type_id: context.actionType.id,
      action_api_name: context.actionType.api_name,
      target_type_id: context.objectType.id,
      target_type_api_name: context.objectType.api_name,
      target_id: claim.id,
      actor: context.callerIdentity ?? context.actor,
      params,
      result: updated,
      ...(context.authorizedByProposal ? { authorized_by_proposal: context.authorizedByProposal } : {}),
    }).execute();
    return updated;
  });
}

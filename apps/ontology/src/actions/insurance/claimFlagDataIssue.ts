import type { ClaimTable, DataIssueTable } from "../../db.ts";
import { actionTransaction, type ActionContext } from "../manufacturing/batchDeferStart.ts";

export async function claimFlagDataIssue(
  claim: ClaimTable,
  params: { reason: string },
  context: ActionContext,
): Promise<DataIssueTable> {
  if (!params.reason.trim()) throw new Error("reason must not be empty.");

  return actionTransaction(context, async (trx) => {
    const issue = await trx.insertInto("insurance.data_issue").values({
      id: `DI-${claim.id}-${Date.now()}`,
      claim_id: claim.id,
      reason: params.reason,
      status: "open",
    }).returningAll().executeTakeFirstOrThrow();
    await trx.withSchema("insurance").insertInto("audit_log").values({
      action_type_id: context.actionType.id,
      action_api_name: context.actionType.api_name,
      target_type_id: context.objectType.id,
      target_type_api_name: context.objectType.api_name,
      target_id: claim.id,
      actor: context.callerIdentity ?? context.actor,
      params,
      result: issue,
      ...(context.authorizedByProposal ? { authorized_by_proposal: context.authorizedByProposal } : {}),
    }).execute();
    return issue;
  });
}

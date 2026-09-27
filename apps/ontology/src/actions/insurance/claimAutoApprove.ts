import type { ClaimTable, CoverageClauseTable, PolicyTable } from "../../db.ts";
import { sql } from "kysely";
import { actionTransaction, type ActionContext } from "../manufacturing/batchDeferStart.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateValue(value: string | null) {
  if (!value) return NaN;
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

export async function claimAutoApprove(
  claim: ClaimTable,
  params: { reason: string; citedClauseIds: string[]; approvedAmount: number },
  context: ActionContext,
): Promise<ClaimTable> {
  if (claim.status !== "filed") throw new Error(`Claim ${claim.id} cannot be auto-approved while status is ${claim.status}; it must be filed.`);
  if (!params.reason.trim()) throw new Error("reason must not be empty.");
  if (!params.citedClauseIds.length) throw new Error("citedClauseIds must contain at least one clause ID.");
  if (!Number.isFinite(params.approvedAmount) || params.approvedAmount <= 0) throw new Error("approvedAmount must be positive.");
  const amountClaimed = Number(claim.amount_claimed);
  if (!Number.isFinite(amountClaimed) || params.approvedAmount > amountClaimed) throw new Error("approvedAmount must be no greater than amountClaimed.");
  if (!claim.policy_id) throw new Error(`Claim ${claim.id} has no linked policy.`);
  if (!claim.incident_date || !claim.filed_date) throw new Error(`Claim ${claim.id} is missing incidentDate or filedDate.`);
  if (claim.documents_complete !== true) throw new Error(`Claim ${claim.id} does not have complete documents.`);

  return actionTransaction(context, async (trx) => {
    const claimDates = await trx
      .selectFrom("insurance.claim")
      .select([
        sql<string>`incident_date::text`.as("incident_date"),
        sql<string>`filed_date::text`.as("filed_date"),
      ])
      .where("id", "=", claim.id)
      .executeTakeFirst();
    const policy = await trx
      .selectFrom("insurance.policy")
      .selectAll()
      .select([
        sql<string>`start_date::text`.as("start_date"),
        sql<string>`end_date::text`.as("end_date"),
      ])
      .where("id", "=", claim.policy_id!)
      .executeTakeFirst();
    if (!policy) throw new Error(`Policy ${claim.policy_id} was not found.`);
    if (policy.status !== "active") throw new Error(`Policy ${policy.id} is not active.`);
    const incident = dateValue(claimDates?.incident_date ?? null);
    const start = dateValue(policy.start_date);
    const end = dateValue(policy.end_date);
    const filed = dateValue(claimDates?.filed_date ?? null);
    if (![incident, start, end, filed].every(Number.isFinite) || incident < start || incident > end) {
      throw new Error(`Claim ${claim.id} incidentDate is outside policy ${policy.id}'s coverage period.`);
    }
    const reportingDays = policy.reporting_window_days;
    if (reportingDays === null || filed < incident || filed - incident > reportingDays * DAY_MS) {
      throw new Error(`Claim ${claim.id} was filed outside policy ${policy.id}'s reporting window.`);
    }

    const clauses = await trx
      .selectFrom("insurance.coverage_clause")
      .selectAll()
      .where("id", "in", params.citedClauseIds)
      .execute();
    const qualifyingClause = clauses.find((clause: CoverageClauseTable) => clause.limit_amount !== null && Number(clause.limit_amount) >= params.approvedAmount);
    if (!qualifyingClause) throw new Error("At least one cited CoverageClause must have a limitAmount at least as large as approvedAmount.");

    const updated = await trx
      .updateTable("insurance.claim")
      .set({ status: "autoApproved" })
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

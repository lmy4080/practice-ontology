import type { ProposalTable } from "../../db.ts";
import type { Database } from "../../db.ts";
import type { ActionContext } from "../manufacturing/batchDeferStart.ts";
import { sql } from "kysely";
import { actionHandlers } from "../../schema.ts";
import { ACTIVE_ONTOLOGY_SCHEMA } from "../../db.ts";
import "../../clock.ts";

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function decisionParams(decisionNote?: string) {
  return decisionNote === undefined ? {} : { decisionNote };
}

async function loadPendingProposal(proposal: ProposalTable, context: ActionContext) {
  const current = await context.db
    .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
    .selectFrom("proposal")
    .selectAll()
    .where("id", "=", proposal.id)
    .forUpdate()
    .executeTakeFirstOrThrow();
  if (current.status !== "pending") throw new Error(`Proposal ${proposal.id} is already ${current.status}.`);
  return current;
}

async function loadReviewableProposal(proposal: ProposalTable, context: ActionContext) {
  const current = await context.db
    .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
    .selectFrom("proposal")
    .selectAll()
    .where("id", "=", proposal.id)
    .forUpdate()
    .executeTakeFirstOrThrow();
  if (current.status !== "pending" && current.status !== "escalated") {
    throw new Error(`Proposal ${proposal.id} is already ${current.status}.`);
  }
  return current;
}

async function writeDecisionAudit(
  proposal: ProposalTable,
  result: unknown,
  params: Record<string, string>,
  context: ActionContext,
) {
  await context.db
    .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
    .insertInto("audit_log")
    .values({
      action_type_id: context.actionType.id,
      action_api_name: context.actionType.api_name,
      target_type_id: context.objectType.id,
      target_type_api_name: context.objectType.api_name,
      target_id: String(proposal.id),
      actor: context.callerIdentity ?? "system",
      params,
      result,
      authorized_by_proposal: null,
    })
    .execute();
}

export async function proposalApprove(
  proposal: ProposalTable,
  params: { decisionNote?: string },
  context: ActionContext,
) {
  const reviewer = context.callerIdentity ?? "system";
  return context.db.transaction().execute(async (trx) => {
    const current = await loadReviewableProposal(proposal, { ...context, db: trx as unknown as import("kysely").Kysely<Database> });
    const [objectApiName, actionApiName] = current.type.split(".");
    const handler = actionHandlers[current.type];
    if (!objectApiName || !actionApiName || !handler) throw new Error(`Unknown proposal action: ${current.type}`);

    const objectType = await trx
      .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
      .selectFrom("object_type")
      .selectAll()
      .where("api_name", "=", objectApiName)
      .executeTakeFirst();
    if (!objectType || !SAFE_IDENTIFIER.test(objectType.datasource_table)) throw new Error(`Unknown proposal object type: ${objectApiName}`);

    const actionType = await trx
      .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
      .selectFrom("action_type")
      .selectAll()
      .where("object_type_id", "=", objectType.id)
      .where("api_name", "=", actionApiName)
      .executeTakeFirst();
    if (!actionType) throw new Error(`Unknown proposal action metadata: ${current.type}`);

    const target = await trx
      .withSchema(objectType.schema)
      .selectFrom(sql.id(objectType.schema, objectType.datasource_table))
      .selectAll()
      .where("id" as never, "=", current.target_id)
      .executeTakeFirst();
    if (!target) throw new Error(`Proposal target not found: ${current.target_id}`);

    const triggeredResult = await handler(target, current.params, {
      ...context,
      db: trx as unknown as import("kysely").Kysely<Database>,
      actor: reviewer,
      callerIdentity: reviewer,
      objectType,
      actionType,
      authorizedByProposal: String(current.id),
    });

    const updated = await trx
      .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
      .updateTable("proposal")
      .set({ status: "approved", reviewed_by: reviewer, reviewed_at: new Date(), decision_note: params.decisionNote ?? null })
      .where("id", "=", current.id)
      .where("status", "in", ["pending", "escalated"])
      .returningAll()
      .executeTakeFirstOrThrow();
    const result = { status: updated.status, triggeredAction: current.type, triggeredResult, triggeredTargetId: current.target_id };
    await writeDecisionAudit(updated, result, decisionParams(params.decisionNote), { ...context, db: trx as unknown as import("kysely").Kysely<Database> });
    return result;
  });
}

export async function proposalReject(
  proposal: ProposalTable,
  params: { decisionNote?: string },
  context: ActionContext,
) {
  const reviewer = context.callerIdentity ?? "system";
  return context.db.transaction().execute(async (trx) => {
    const current = await loadReviewableProposal(proposal, { ...context, db: trx as unknown as import("kysely").Kysely<Database> });
    const updated = await trx
      .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
      .updateTable("proposal")
      .set({ status: "rejected", reviewed_by: reviewer, reviewed_at: new Date(), decision_note: params.decisionNote ?? null })
      .where("id", "=", current.id)
      .where("status", "in", ["pending", "escalated"])
      .returningAll()
      .executeTakeFirstOrThrow();
    const result = { status: updated.status };
    await writeDecisionAudit(updated, result, decisionParams(params.decisionNote), { ...context, db: trx as unknown as import("kysely").Kysely<Database> });
    return result;
  });
}

export async function proposalEscalate(
  proposal: ProposalTable,
  params: { note: string },
  context: ActionContext,
) {
  const reviewer = context.callerIdentity ?? "system";
  return context.db.transaction().execute(async (trx) => {
    const current = await loadPendingProposal(proposal, { ...context, db: trx as unknown as import("kysely").Kysely<Database> });
    if (!params.note.trim()) throw new Error("note must not be empty.");
    const updated = await trx
      .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
      .updateTable("proposal")
      .set({ status: "escalated", reviewed_by: reviewer, reviewed_at: new Date(), decision_note: params.note })
      .where("id", "=", current.id)
      .where("status", "=", "pending")
      .returningAll()
      .executeTakeFirstOrThrow();
    const result = { status: updated.status, note: params.note };
    await writeDecisionAudit(updated, result, { note: params.note }, { ...context, db: trx as unknown as import("kysely").Kysely<Database> });
    return result;
  });
}

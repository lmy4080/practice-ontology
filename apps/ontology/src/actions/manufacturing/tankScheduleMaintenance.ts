import type { TankTable } from "../../db.ts";
import { actionTransaction, type ActionContext } from "./batchDeferStart.ts";

const maintenanceTypes = new Set(["inspection", "preventive", "corrective", "cleaning"]);

export async function tankScheduleMaintenance(
  tank: TankTable,
  params: { type: string; plannedAt: string; notes: string },
  context: ActionContext,
) {
  const plannedAt = new Date(params.plannedAt);
  if (!maintenanceTypes.has(params.type)) throw new Error("type must be a valid maintenance type.");
  if (!Number.isFinite(plannedAt.getTime())) throw new Error("plannedAt must be a valid date.");

  return actionTransaction(context, async (trx) => {
    const fermentingBatch = await trx
      .selectFrom("manufacturing.batch")
      .select("id")
      .where("assigned_tank_id", "=", tank.id)
      .where("status", "=", "fermenting")
      .executeTakeFirst();
    if (fermentingBatch) {
      throw new Error(`Tank ${tank.id} cannot be scheduled for maintenance while batch ${fermentingBatch.id} is fermenting.`);
    }

    const updatedTank = await trx
      .updateTable("manufacturing.tank")
      .set({ status: "maintenance" })
      .where("id", "=", tank.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    const maintenanceLog = await trx
      .insertInto("manufacturing.maintenance_log")
      .values({
        id: `ML-${tank.id}-${Date.now()}`,
        target_type: "tank",
        target_id: tank.id,
        type: params.type,
        status: "scheduled",
        planned_at: plannedAt,
        started_at: null,
        completed_at: null,
        notes: params.notes,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const result = { tank: updatedTank, maintenanceLog };

    await trx
      .withSchema("manufacturing")
      .insertInto("audit_log")
      .values({
        action_type_id: context.actionType.id,
        action_api_name: context.actionType.api_name,
        target_type_id: context.objectType.id,
        target_type_api_name: context.objectType.api_name,
        target_id: tank.id,
        actor: context.actor,
        params,
        result,
        ...(context.authorizedByProposal ? { authorized_by_proposal: context.authorizedByProposal } : {}),
        ...(context.authorizedByProposal ? { authorized_by_proposal: context.authorizedByProposal } : {}),
      })
      .execute();

    return result;
  });
}

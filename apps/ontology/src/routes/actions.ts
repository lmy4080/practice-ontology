import { Validator, type Schema } from "@cfworker/json-schema";
import { Hono } from "hono";

import { type ActionContext } from "../actions/manufacturing/batchDeferStart.ts";
import { actionHandlers } from "../schema.ts";
import { db, type Database } from "../db.ts";

const INSTANCE_SCHEMAS = new Set(["manufacturing"]);
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

type ActionHandler = (instance: unknown, params: unknown | undefined, context: ActionContext) => Promise<unknown>;

function tableKey(schema: string, table: string) {
  return `${schema}.${table}` as keyof Database;
}

export const actionRoutes = new Hono();

actionRoutes.post("/:type/:id/actions/:actionName", async (c) => {
  const type = await db
    .withSchema("manufacturing")
    .selectFrom("object_type")
    .selectAll()
    .where("api_name", "=", c.req.param("type"))
    .executeTakeFirst();

  if (!type || !INSTANCE_SCHEMAS.has(type.schema) || !SAFE_IDENTIFIER.test(type.datasource_table)) {
    return c.json({ error: "Unknown object type" }, 404);
  }

  const actionName = c.req.param("actionName");
  const actions = await db
    .withSchema(type.schema)
    .selectFrom("action_type")
    .selectAll()
    .where("object_type_id", "=", type.id)
    .execute();
  const action = actions.find((candidate) => candidate.api_name === actionName || candidate.api_name === `${type.api_name}.${actionName}`);
  if (!action) return c.json({ error: "Unknown action" }, 404);

  const shortActionName = action.api_name.split(".").pop() ?? action.api_name;
  const handler = actionHandlers[`${type.api_name}.${shortActionName}`];
  if (!handler) return c.json({ error: "Action is not implemented" }, 501);

  let params: unknown;
  try {
    params = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const validation = new Validator(action.parameter_schema as Schema).validate(params);
  if (!validation.valid) return c.json({ error: "Invalid action parameters", details: validation.errors }, 400);

  const instance = await db
    .selectFrom(tableKey(type.schema, type.datasource_table))
    .selectAll()
    .where("id" as never, "=", c.req.param("id"))
    .executeTakeFirst();
  if (!instance) return c.json({ error: "Object not found" }, 404);

  try {
    const result = await handler(instance, params, {
      db,
      actor: c.req.header("x-actor") ?? "system",
      callerIdentity: c.req.header("x-actor") ?? "system",
      objectType: type,
      actionType: action,
    });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Action failed" }, 400);
  }
});

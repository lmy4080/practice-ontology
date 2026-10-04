import { Validator, type Schema } from "@cfworker/json-schema";
import { Hono } from "hono";
import { sql } from "kysely";

import { type ActionContext } from "../actions/manufacturing/batchDeferStart.ts";
import { actionHandlers } from "../schema.ts";
import { ACTIVE_ONTOLOGY_SCHEMA, db, INSTANCE_SCHEMAS } from "../db.ts";

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

type ActionHandler = (instance: unknown, params: unknown | undefined, context: ActionContext) => Promise<unknown>;

export const actionRoutes = new Hono();

actionRoutes.post("/:type/:id/actions/:actionName", async (c) => {
  const type = await db
    .withSchema(ACTIVE_ONTOLOGY_SCHEMA)
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

  const callerIdentity = c.req.header("x-caller-identity") ?? "system";
  const allowedCallers = action.allowed_callers ?? [];
  const accessAllowed = allowedCallers.length === 0 || allowedCallers.includes(callerIdentity);
  const accessReason = accessAllowed
    ? allowedCallers.length === 0
      ? "Action is unrestricted"
      : `Caller ${callerIdentity} is allowed`
    : `Caller ${callerIdentity} is not allowed for ${action.api_name}`;

  await db.withSchema(type.schema).insertInto("access_log").values({
    caller_identity: callerIdentity,
    action_type: action.api_name,
    target_type: type.api_name,
    target_id: c.req.param("id"),
    decision: accessAllowed ? "allowed" : "denied",
    reason: accessReason,
  }).execute();

  if (!accessAllowed) return c.json({ error: "Action caller is not authorized", reason: accessReason }, 403);

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
    .withSchema(type.schema)
    .selectFrom(sql.id(type.schema, type.datasource_table))
    .selectAll()
    .where(sql.id("id"), "=", c.req.param("id"))
    .executeTakeFirst();
  if (!instance) return c.json({ error: "Object not found" }, 404);

  try {
    const result = await handler(instance, params, {
      db,
      actor: c.req.header("x-actor") ?? "system",
      callerIdentity,
      objectType: type,
      actionType: action,
    });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Action failed" }, 400);
  }
});

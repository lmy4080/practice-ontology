import { Hono } from "hono";

import { db } from "../db.ts";

const INSTANCE_SCHEMAS = new Set(["manufacturing"]);

function schemaFor(c: { req: { query: (key: string) => string | undefined } }) {
  const schema = c.req.query("schema") ?? "manufacturing";
  return INSTANCE_SCHEMAS.has(schema) ? schema : undefined;
}

export const metaRoutes = new Hono();

metaRoutes.get("/meta/types", async (c) => {
  const schema = schemaFor(c);
  if (!schema) return c.json({ error: "Unknown schema" }, 400);

  const types = await db.withSchema(schema).selectFrom("object_type").selectAll().orderBy("api_name").execute();
  return c.json(types);
});

metaRoutes.get("/meta/types/:type", async (c) => {
  const schema = schemaFor(c);
  if (!schema) return c.json({ error: "Unknown schema" }, 400);

  const metadataDb = db.withSchema(schema);
  const type = await metadataDb
    .selectFrom("object_type")
    .selectAll()
    .where("api_name", "=", c.req.param("type"))
    .executeTakeFirst();

  if (!type) return c.json({ error: "Unknown object type" }, 404);

  const [properties, outbound, inbound, actions] = await Promise.all([
    metadataDb.selectFrom("property").selectAll().where("object_type_id", "=", type.id).orderBy("api_name").execute(),
    metadataDb.selectFrom("link").selectAll().where("source_type_id", "=", type.id).orderBy("api_name").execute(),
    metadataDb.selectFrom("link").selectAll().where("target_type_id", "=", type.id).orderBy("api_name").execute(),
    metadataDb.selectFrom("action_type").selectAll().where("object_type_id", "=", type.id).orderBy("api_name").execute(),
  ]);

  return c.json({ object_type: type, properties, links: { outbound, inbound }, actions });
});

metaRoutes.patch("/meta/types/:type", async (c) => {
  const schema = schemaFor(c);
  if (!schema) return c.json({ error: "Unknown schema" }, 400);

  let body: { display_name?: unknown; description?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const update: { name?: string; description?: string | null } = {};
  if (body.display_name !== undefined) {
    if (typeof body.display_name !== "string" || !body.display_name.trim()) {
      return c.json({ error: "display_name must be a non-empty string" }, 400);
    }
    update.name = body.display_name.trim();
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      return c.json({ error: "description must be a string or null" }, 400);
    }
    update.description = typeof body.description === "string" ? body.description.trim() : null;
  }
  if (!Object.keys(update).length) return c.json({ error: "No editable fields provided" }, 400);

  const type = await db
    .withSchema(schema)
    .selectFrom("object_type")
    .select("id")
    .where("api_name", "=", c.req.param("type"))
    .executeTakeFirst();
  if (!type) return c.json({ error: "Unknown object type" }, 404);

  const updated = await db
    .withSchema(schema)
    .updateTable("object_type")
    .set(update)
    .where("id", "=", type.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return c.json(updated);
});

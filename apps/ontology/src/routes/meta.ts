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

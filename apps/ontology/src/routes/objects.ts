import { Hono } from "hono";

import { db, type Database } from "../db.ts";

const INSTANCE_SCHEMAS = new Set(["manufacturing"]);
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function validTable(schema: string, table: string) {
  return INSTANCE_SCHEMAS.has(schema) && SAFE_IDENTIFIER.test(table);
}

function tableKey(schema: string, table: string) {
  return `${schema}.${table}` as keyof Database;
}

function isArrayCardinality(cardinality: string) {
  return cardinality === "one_to_many" || cardinality === "many_to_many";
}

async function objectType(type: string) {
  return db
    .withSchema("manufacturing")
    .selectFrom("object_type")
    .selectAll()
    .where("api_name", "=", type)
    .executeTakeFirst();
}

async function propertiesFor(typeId: string) {
  return db.withSchema("manufacturing").selectFrom("property").selectAll().where("object_type_id", "=", typeId).execute();
}

async function linksFor(where: "source_type_id" | "target_type_id", typeId: string) {
  return db.withSchema("manufacturing").selectFrom("link").selectAll().where(where, "=", typeId).execute();
}

async function metadataType(id: string) {
  return db.withSchema("manufacturing").selectFrom("object_type").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function property(id: string) {
  return db.withSchema("manufacturing").selectFrom("property").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function readTable(schema: string, table: string, id?: string) {
  const query = db.selectFrom(tableKey(schema, table));
  return id === undefined
    ? query.selectAll().execute()
    : query.selectAll().where("id" as never, "=", id).executeTakeFirst();
}

export const objectRoutes = new Hono();

objectRoutes.get("/:type", async (c) => {
  const type = await objectType(c.req.param("type"));
  if (!type || !validTable(type.schema, type.datasource_table)) return c.json({ error: "Unknown object type" }, 404);

  const properties = await propertiesFor(type.id);
  let query = db.selectFrom(tableKey(type.schema, type.datasource_table));
  for (const [apiName, value] of Object.entries(c.req.query())) {
    const prop = properties.find((candidate) => candidate.api_name === apiName);
    if (!prop || !SAFE_IDENTIFIER.test(prop.datasource_column)) return c.json({ error: `Unknown filter: ${apiName}` }, 400);
    query = query.where(prop.datasource_column as never, "=", value) as typeof query;
  }

  return c.json(await query.selectAll().execute());
});

objectRoutes.get("/:type/:id", async (c) => {
  const type = await objectType(c.req.param("type"));
  if (!type || !validTable(type.schema, type.datasource_table)) return c.json({ error: "Unknown object type" }, 404);

  const row = await readTable(type.schema, type.datasource_table, c.req.param("id"));
  if (!row) return c.json({ error: "Object not found" }, 404);

  const [outboundLinks, inboundLinks] = await Promise.all([
    linksFor("source_type_id", type.id),
    linksFor("target_type_id", type.id),
  ]);
  const links: Record<string, unknown> = {};

  for (const link of outboundLinks) {
    const via = await property(link.via_property_id);
    const targetType = await metadataType(link.target_type_id);
    if (!validTable(targetType.schema, targetType.datasource_table) || !SAFE_IDENTIFIER.test(via.datasource_column)) continue;
    const targetId = (row as Record<string, unknown>)[via.datasource_column];
    if (targetId === null || targetId === undefined) {
      links[link.api_name] = isArrayCardinality(link.cardinality) ? [] : null;
      continue;
    }
    const target = await readTable(targetType.schema, targetType.datasource_table, String(targetId));
    links[link.api_name] = isArrayCardinality(link.cardinality) ? (target ? [target] : []) : target ?? null;
  }

  for (const link of inboundLinks) {
    const sourceType = await metadataType(link.source_type_id);
    const via = await property(link.via_property_id);
    if (!validTable(sourceType.schema, sourceType.datasource_table) || !SAFE_IDENTIFIER.test(via.datasource_column)) continue;
    const sources = await db
      .selectFrom(tableKey(sourceType.schema, sourceType.datasource_table))
      .selectAll()
      .where(via.datasource_column as never, "=", c.req.param("id"))
      .execute();
    links[link.inverse_api_name] = link.cardinality === "one_to_one" ? sources[0] ?? null : sources;
  }

  return c.json({ ...row, links });
});

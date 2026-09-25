import { Hono } from "hono";

import { db, type Database } from "../db.ts";

const INSTANCE_SCHEMAS = new Set(["manufacturing"]);
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function validTable(schema: string, table: string) {
  return INSTANCE_SCHEMAS.has(schema) && SAFE_IDENTIFIER.test(table);
}

function validCreateValue(dataType: string, value: unknown) {
  if (value === null) return true;
  if (dataType === "string" || dataType === "enum" || dataType === "datetime" || dataType === "date") return typeof value === "string";
  if (dataType === "number") return typeof value === "number" && Number.isFinite(value);
  if (dataType === "boolean") return typeof value === "boolean";
  if (dataType === "string[]") return Array.isArray(value) && value.every((item) => typeof item === "string");
  return true;
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

const QUERY_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "isNull", "isNotNull"]);

objectRoutes.post("/:type", async (c) => {
  const type = await objectType(c.req.param("type"));
  if (!type || !validTable(type.schema, type.datasource_table)) return c.json({ error: "Unknown object type" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return c.json({ error: "Request body must be an object" }, 400);

  const properties = await propertiesFor(type.id);
  const propertyByApiName = new Map(properties.map((property) => [property.api_name, property]));
  const values: Record<string, unknown> = {};
  for (const [apiName, value] of Object.entries(body)) {
    const property = propertyByApiName.get(apiName);
    if (!property || !SAFE_IDENTIFIER.test(property.datasource_column)) return c.json({ error: `Unknown property: ${apiName}` }, 400);
    if (!validCreateValue(property.data_type, value)) return c.json({ error: `Invalid value for property: ${apiName}` }, 400);
    values[property.datasource_column] = value;
  }

  for (const property of properties) {
    if (property.required && !property.is_primary_key && !(property.api_name in body)) {
      return c.json({ error: `Missing required property: ${property.api_name}` }, 400);
    }
  }

  try {
    return c.json(await db
      .insertInto(tableKey(type.schema, type.datasource_table))
      .values(values as never)
      .returningAll()
      .executeTakeFirstOrThrow());
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to create object" }, 400);
  }
});

objectRoutes.post("/:type/query", async (c) => {
  const type = await objectType(c.req.param("type"));
  if (!type || !validTable(type.schema, type.datasource_table)) return c.json({ error: "Unknown object type" }, 404);

  let body: { filters?: unknown; limit?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const properties = await propertiesFor(type.id);
  const filters = body.filters ?? [];
  if (!Array.isArray(filters)) return c.json({ error: "filters must be an array" }, 400);

  let limit = body.limit ?? 100;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return c.json({ error: "limit must be an integer between 1 and 1000" }, 400);
  }

  let query = db.selectFrom(tableKey(type.schema, type.datasource_table));
  for (const filter of filters) {
    if (!filter || typeof filter !== "object") return c.json({ error: "Each filter must be an object" }, 400);
    const { property, op, value } = filter as { property?: unknown; op?: unknown; value?: unknown };
    const metadata = properties.find((candidate) => candidate.api_name === property);
    if (!metadata || !SAFE_IDENTIFIER.test(metadata.datasource_column)) return c.json({ error: `Unknown filter property: ${String(property)}` }, 400);
    if (typeof op !== "string" || !QUERY_OPS.has(op)) return c.json({ error: `Unknown filter operator: ${String(op)}` }, 400);
    const column = metadata.datasource_column as never;
    if (op === "isNull") query = query.where(column, "is", null) as typeof query;
    else if (op === "isNotNull") query = query.where(column, "is not", null) as typeof query;
    else if (op === "in") {
      if (!Array.isArray(value)) return c.json({ error: "The in operator requires an array value" }, 400);
      query = query.where(column, "in", value as never) as typeof query;
    } else if (op === "contains") {
      if (typeof value !== "string") return c.json({ error: "The contains operator requires a string value" }, 400);
      query = query.where(column, "like", `%${value}%`) as typeof query;
    } else {
      const operator = ({ eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" } as const)[op as "eq" | "neq" | "gt" | "gte" | "lt" | "lte"];
      query = query.where(column, operator, value as never) as typeof query;
    }
  }

  return c.json(await query.selectAll().limit(limit).execute());
});

objectRoutes.get("/:type/:id/audit", async (c) => {
  const type = await objectType(c.req.param("type"));
  if (!type) return c.json({ error: "Unknown object type" }, 404);

  const entries = await db
    .withSchema("manufacturing")
    .selectFrom("audit_log")
    .innerJoin("action_type", "action_type.id", "audit_log.action_type_id")
    .select([
      "action_type.name as action_name",
      "actor",
      "params",
      "result",
      "created_at as timestamp",
    ])
    .where("target_type_api_name", "=", type.api_name)
    .where("target_id", "=", c.req.param("id"))
    .orderBy("created_at", "desc")
    .execute();

  return c.json(entries);
});

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

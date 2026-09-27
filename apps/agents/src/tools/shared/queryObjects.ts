export type QueryFilter = {
  property: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "isNull" | "isNotNull";
  value?: unknown;
};

export type QueryObjectsInput = {
  type: string;
  filters?: QueryFilter[];
  limit?: number;
};

export type GetObjectInput = {
  type: string;
  id: string;
};

export type InvokeActionInput = {
  type: string;
  id: string;
  action: string;
  params: Record<string, unknown>;
};

export type CreateObjectInput = {
  type: string;
  properties: Record<string, unknown>;
};

function callerHeaders() {
  const headers = new Headers({ "content-type": "application/json" });
  if (process.env.CALLER_IDENTITY) headers.set("x-caller-identity", process.env.CALLER_IDENTITY);
  return headers;
}

export async function queryObjects({ type, filters, limit }: QueryObjectsInput) {
  const honoUrl = process.env.HONO_URL ?? "http://localhost:3000";
  const response = await fetch(`${honoUrl}/api/objects/${encodeURIComponent(type)}/query`, {
    method: "POST",
    headers: callerHeaders(),
    body: JSON.stringify({ filters, limit }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 200)}`);
  return body;
}

export async function getObject({ type, id }: GetObjectInput) {
  const ontologyUrl = process.env.ONTOLOGY_URL ?? "http://localhost:3000";
  const response = await fetch(`${ontologyUrl}/api/objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { headers: callerHeaders() });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 200)}`);
  return body;
}

export async function invokeAction({ type, id, action, params }: InvokeActionInput) {
  const ontologyUrl = process.env.ONTOLOGY_URL ?? "http://localhost:3000";
  const response = await fetch(`${ontologyUrl}/api/objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action)}`, {
    method: "POST",
    headers: callerHeaders(),
    body: JSON.stringify(params),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 200)}`);
  return body;
}

export async function createObject({ type, properties }: CreateObjectInput) {
  const ontologyUrl = process.env.ONTOLOGY_URL ?? "http://localhost:3000";
  const response = await fetch(`${ontologyUrl}/api/objects/${encodeURIComponent(type)}`, {
    method: "POST",
    headers: callerHeaders(),
    body: JSON.stringify(properties),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body) as Record<string, unknown>;
}

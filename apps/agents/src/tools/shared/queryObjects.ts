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

export async function queryObjects({ type, filters, limit }: QueryObjectsInput) {
  const honoUrl = process.env.HONO_URL ?? "http://localhost:3000";
  const response = await fetch(`${honoUrl}/api/objects/${encodeURIComponent(type)}/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filters, limit }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 200)}`);
  return body;
}

export async function getObject({ type, id }: GetObjectInput) {
  const ontologyUrl = process.env.ONTOLOGY_URL ?? "http://localhost:3000";
  const response = await fetch(`${ontologyUrl}/api/objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 200)}`);
  return body;
}

export async function invokeAction({ type, id, action, params }: InvokeActionInput) {
  const ontologyUrl = process.env.ONTOLOGY_URL ?? "http://localhost:3000";
  const response = await fetch(`${ontologyUrl}/api/objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 200)}`);
  return body;
}

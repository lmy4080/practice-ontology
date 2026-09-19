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

const ontologyUrl = (process.env.ONTOLOGY_URL ?? "http://localhost:3000").replace(/\/$/, "");

type SchemaType = {
  id: string;
  api_name: string;
  name?: string | null;
  description?: string | null;
  properties?: Array<{ api_name: string; data_type?: string | null }>;
  links?: {
    outbound?: Array<{ api_name: string; target_type_id?: string; cardinality?: string }>;
    inbound?: Array<{ api_name: string; source_type_id?: string; cardinality?: string }>;
  };
  actions?: Array<{ api_name: string; name?: string | null; description?: string | null }>;
};

type SchemaDetail = Omit<SchemaType, "api_name" | "id"> & {
  object_type: SchemaType;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function buildSchemaBlock(): Promise<string> {
  const types = await fetchJson<SchemaType[]>(`${ontologyUrl}/api/objects/meta/types`);
  const details = await Promise.all(types.map((type) =>
    fetchJson<SchemaDetail>(`${ontologyUrl}/api/objects/meta/types/${encodeURIComponent(type.api_name)}`),
  ));
  const names = new Map(types.map((type) => [type.id, type.api_name]));
  const typeName = (id?: string) => (id && names.get(id)) || "unknown";

  return [
    "## Ontology schema",
    "Use the API names and property names below when calling the ontology tools.",
    ...details.map(({ object_type: type, properties, links, actions }) => [
      `### ${type.api_name}${type.name ? ` (${type.name})` : ""}`,
      type.description ?? "",
      `properties: ${(properties ?? []).map((property) => `${property.api_name}: ${property.data_type ?? "unknown"}`).join(", ") || "none"}`,
      `links: ${[
        ...(links?.outbound ?? []).map((link) => `${link.api_name} -> ${typeName(link.target_type_id)} (${link.cardinality ?? "unknown"})`),
        ...(links?.inbound ?? []).map((link) => `${link.api_name} <- ${typeName(link.source_type_id)} (${link.cardinality ?? "unknown"})`),
      ].join(", ") || "none"}`,
      `actions: ${(actions ?? []).map((action) => `${action.api_name}${action.name ? ` (${action.name})` : ""}${action.description ? `: ${action.description}` : ""}`).join(", ") || "none"}`,
    ].filter(Boolean).join("\n")),
  ].join("\n\n");
}

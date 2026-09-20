import { createServer, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { Codex, type ThreadEvent, type ThreadItem, type Usage } from "@openai/codex-sdk";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";

const PORT = 3455;
const ontologyUrl = (process.env.ONTOLOGY_URL ?? "http://localhost:3000").replace(/\/$/, "");
const mcpServer = fileURLToPath(new URL("./tools/shared/queryObjectsMcp.ts", import.meta.url));
const clients = new Set<ServerResponse>();
let telemetry: NodeSDK | undefined;

export type RunAgentOptions = {
  model?: string;
  workingDirectory?: string;
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
};

export type RunAgentInput = {
  identity: string;
  prompt: string;
  options?: RunAgentOptions;
};

type SchemaType = {
  api_name: string;
  name?: string | null;
  description?: string | null;
  datasource_table?: string;
  properties?: Array<{ api_name: string; name?: string | null; data_type?: string | null; description?: string | null }>;
  links?: { outbound?: Array<{ api_name: string; target_type_id?: string; cardinality?: string }>; inbound?: Array<{ api_name: string; source_type_id?: string; cardinality?: string }> };
};

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function buildSchemaBlock(): Promise<string> {
  const types = await fetchJson<Array<{ api_name: string }>>(`${ontologyUrl}/api/objects/meta/types`);
  const details = await Promise.all(types.map((type) =>
    fetchJson<SchemaType>(`${ontologyUrl}/api/objects/meta/types/${encodeURIComponent(type.api_name)}`),
  ));

  return [
    "## Ontology schema",
    "Use the API names and property names below when calling the ontology tools.",
    ...details.map((type) => [
      `### ${type.api_name}${type.name ? ` (${type.name})` : ""}`,
      type.description ? type.description : "",
      type.datasource_table ? `table: ${type.datasource_table}` : "",
      `properties: ${(type.properties ?? []).map((property) => `${property.api_name}${property.data_type ? `: ${property.data_type}` : ""}`).join(", ") || "none"}`,
      `outbound links: ${(type.links?.outbound ?? []).map((link) => `${link.api_name} (${link.cardinality ?? "unknown"})`).join(", ") || "none"}`,
      `inbound links: ${(type.links?.inbound ?? []).map((link) => `${link.api_name} (${link.cardinality ?? "unknown"})`).join(", ") || "none"}`,
    ].filter(Boolean).join("\n")),
  ].join("\n\n");
}

function installOntologyFetchInterceptor(identity: string) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(ontologyUrl)) return originalFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("x-caller-identity", identity);
    return originalFetch(input, { ...init, headers });
  };
  return () => { globalThis.fetch = originalFetch; };
}

function startTelemetry() {
  if (telemetry) return telemetry;
  telemetry = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor({ shouldExportSpan: () => true, exportMode: "immediate" })],
  });
  telemetry.start();
  return telemetry;
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Ontology Agent</title>
<style>body{font:15px system-ui;margin:0;background:#101114;color:#eee}main{max-width:960px;margin:auto;padding:24px}h1{font-size:22px}.event{border:1px solid #30333b;border-radius:10px;padding:12px;margin:10px 0;background:#17191f}.label{color:#8db8ff;font-weight:700}.muted{color:#9da3ad}pre{white-space:pre-wrap;overflow:auto;margin:8px 0 0}</style></head>
<body><main><h1>Ontology Agent</h1><div id="status" class="muted">Waiting for events…</div><section id="events"></section></main>
<script>const events=document.querySelector('#events'),status=document.querySelector('#status');const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const stream=new EventSource('/events');stream.onmessage=e=>{const x=JSON.parse(e.data);status.textContent=x.kind==='final'?'Completed':x.kind;const el=document.createElement('article');el.className='event';el.innerHTML='<div class="label">'+esc(x.kind)+'</div><pre>'+esc(JSON.stringify(x.value,null,2))+'</pre>';events.append(el)};</script></body></html>`;

function startWebServer() {
  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (request.url === "/events") {
      response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" });
      response.write(`data: ${json({ kind: "connected", value: { port: PORT } })}\n\n`);
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(PORT);
  return server;
}

function publish(kind: string, value: unknown) {
  const message = `data: ${json({ kind, value })}\n\n`;
  for (const client of clients) client.write(message);
}

function publishEvent(event: ThreadEvent) {
  if (event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed") {
    const item = event.item as ThreadItem;
    if (item.type === "mcp_tool_call") publish(item.status === "in_progress" ? "tool_call" : "tool_result", item);
    else if (item.type === "agent_message") publish("assistant_text", item.text);
    else publish(item.type, item);
  } else if (event.type === "turn.completed") publish("turn_completed", event.usage);
  else if (event.type === "turn.failed" || event.type === "error") publish("error", event);
  else publish(event.type, event);
}

function promptWithContext(prompt: string, schema: string) {
  const courseNow = process.env.COURSE_NOW ?? "not set";
  return [
    `COURSE_NOW override date: ${courseNow}`,
    "Treat COURSE_NOW as the date for all time-relative reasoning about ontology data.",
    "You may use only the ontology MCP tools query_objects and get_object.",
    "Do not use Bash, shell, file-read, web, or any other tool or MCP server.",
    schema,
    "## User request",
    prompt,
  ].join("\n\n");
}

export async function runAgent({ identity, prompt, options = {} }: RunAgentInput) {
  const server = startWebServer();
  const restoreFetch = installOntologyFetchInterceptor(identity);
  const sdk = startTelemetry();
  const tracer = trace.getTracer("fde-agents");
  const span = tracer.startSpan(identity, { attributes: { "langfuse.trace.name": identity, "langfuse.user.id": identity } });

  try {
    const schema = await context.with(trace.setSpan(context.active(), span), () => buildSchemaBlock());
    const codex = new Codex();
    const thread = codex.startThread({
      model: options.model,
      workingDirectory: options.workingDirectory ?? process.cwd(),
      sandboxMode: options.sandboxMode ?? "read-only",
      networkAccessEnabled: true,
      approvalPolicy: "never",
      config: {
        mcp_servers: {
          ontology: {
            enabled: true,
            enabled_tools: ["query_objects", "get_object"],
            default_tools_approval_mode: "auto",
            command: process.execPath,
            args: ["--experimental-strip-types", mcpServer],
          },
        },
        web_search: { enabled: false },
        agents: { enabled: false },
      },
    });

    const { events } = await context.with(trace.setSpan(context.active(), span), () =>
      thread.runStreamed(promptWithContext(prompt, schema)),
    );
    let finalResponse = "";
    let usage: Usage | null = null;
    for await (const event of events) {
      publishEvent(event);
      if (event.type === "item.completed" && event.item.type === "agent_message") finalResponse = event.item.text;
      if (event.type === "turn.completed") usage = event.usage;
    }
    span.setStatus({ code: SpanStatusCode.OK });
    publish("final", { text: finalResponse, usage, threadId: thread.id });
    return { finalResponse, usage, threadId: thread.id };
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    publish("error", { message: String(error) });
    throw error;
  } finally {
    span.end();
    restoreFetch();
    clients.clear();
    await sdk.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

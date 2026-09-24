import { execFile } from "node:child_process";
import { createServer, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { Codex, type ThreadEvent, type ThreadItem, type Usage } from "@openai/codex-sdk";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { context, SpanStatusCode, trace, type Context, type Span, type Tracer } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { buildSchemaBlock } from "./helpers/buildSchemaBlock.ts";

export { buildSchemaBlock };

const PORT = 3455;
const DASHBOARD_CONNECT_TIMEOUT_MS = 5000;
const DASHBOARD_GRACE_MS = 10000;
const ontologyUrl = (process.env.ONTOLOGY_URL ?? "http://localhost:3000").replace(/\/$/, "");
const mcpServer = fileURLToPath(new URL("./tools/shared/queryObjectsMcp.ts", import.meta.url));
const clients = new Set<ServerResponse>();
const eventHistory: string[] = [];
let telemetry: NodeSDK | undefined;

export type RunAgentOptions = {
  model?: string;
  workingDirectory?: string;
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
};

export type OntologyTool = "query_objects" | "get_object" | "batch_defer_start" | "tank_schedule_maintenance";

export type RunAgentInput = {
  identity: string;
  prompt: string;
  tools: OntologyTool[];
  systemPrompt?: string;
  options?: RunAgentOptions;
};

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function sse(value: unknown) {
  return JSON.stringify(value);
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
<html><head><meta charset="utf-8"><title>온톨로지 에이전트</title>
<style>body{font:15px system-ui;margin:0;background:#101114;color:#eee}main{max-width:960px;margin:auto;padding:24px}h1{font-size:22px}.event{border:1px solid #30333b;border-radius:10px;padding:12px;margin:10px 0;background:#17191f}.label{color:#8db8ff;font-weight:700}.muted{color:#9da3ad}pre{white-space:pre-wrap;overflow:auto;margin:8px 0 0}</style></head>
<body><main><h1>온톨로지 에이전트</h1><div id="status" class="muted">이벤트 대기 중…</div><section id="events"></section></main>
<script>const events=document.querySelector('#events'),status=document.querySelector('#status');const labels={connected:'연결됨',tool_call:'도구 호출',tool_result:'도구 결과',assistant_text:'에이전트 응답',turn_completed:'턴 완료',final:'완료',error:'오류',item_started:'항목 시작',item_completed:'항목 완료'};const label=k=>labels[k]??k;const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const stream=new EventSource('/events');stream.onopen=()=>{status.textContent='연결됨';};stream.onmessage=e=>{const x=JSON.parse(e.data);status.textContent=label(x.kind);const el=document.createElement('article');el.className='event';el.innerHTML='<div class="label">'+esc(label(x.kind))+'</div><pre>'+esc(JSON.stringify(x.value,null,2))+'</pre>';events.append(el)};stream.onerror=()=>{status.textContent='연결 끊김';stream.close();};</script></body></html>`;

function startWebServer() {
  eventHistory.length = 0;
  let resolveDashboardConnected: () => void = () => {};
  const dashboardConnected = new Promise<void>((resolve) => {
    resolveDashboardConnected = resolve;
  });
  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (request.url === "/events") {
      response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" });
      response.write(`data: ${sse({ kind: "connected", value: { port: PORT } })}\n\n`);
      for (const message of eventHistory) response.write(message);
      clients.add(response);
      resolveDashboardConnected();
      request.on("close", () => clients.delete(response));
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(PORT, () => {
    if (process.platform === "darwin") execFile("open", [`http://localhost:${PORT}`]);
  });
  return { server, dashboardConnected };
}

function publish(kind: string, value: unknown) {
  const message = `data: ${sse({ kind, value })}\n\n`;
  eventHistory.push(message);
  for (const client of clients) client.write(message);
}

type EventTracing = {
  parentContext: Context;
  tracer: Tracer;
  toolSpans: Map<string, Span>;
};

function publishEvent(event: ThreadEvent, tracing: EventTracing) {
  if (event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed") {
    const item = event.item as ThreadItem;
    if (item.type === "mcp_tool_call") {
      let toolSpan = tracing.toolSpans.get(item.id);
      if (!toolSpan && item.status === "in_progress") {
        toolSpan = tracing.tracer.startSpan(`mcp__${item.server}__${item.tool}`, {
          attributes: {
            "langfuse.observation.input": JSON.stringify(item.arguments),
            "mcp.server": item.server,
            "mcp.tool": item.tool,
          },
        }, tracing.parentContext);
        tracing.toolSpans.set(item.id, toolSpan);
      }
      if (toolSpan && item.status !== "in_progress") {
        toolSpan.setAttribute("langfuse.observation.output", JSON.stringify(item.result ?? item.error ?? null));
        if (item.status === "failed") {
          const message = item.error?.message ?? "MCP tool call failed";
          toolSpan.recordException(new Error(message));
          toolSpan.setStatus({ code: SpanStatusCode.ERROR, message });
        } else {
          toolSpan.setStatus({ code: SpanStatusCode.OK });
        }
        toolSpan.end();
        tracing.toolSpans.delete(item.id);
      }
      publish(item.status === "in_progress" ? "tool_call" : "tool_result", item);
    }
    else if (item.type === "agent_message") publish("assistant_text", item.text);
    else publish(item.type, item);
  } else if (event.type === "turn.completed") publish("turn_completed", event.usage);
  else if (event.type === "turn.failed" || event.type === "error") publish("error", event);
  else publish(event.type, event);
}

function renderToConsole(event: ThreadEvent) {
  if (event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed") {
    const item = event.item as ThreadItem;
    if (item.type === "mcp_tool_call") {
      console.log(`[${item.status === "in_progress" ? "tool" : "tool result"}] ${item.server}/${item.tool}`);
    } else if (item.type === "agent_message") {
      console.log(`[assistant] ${item.text}`);
    }
  } else if (event.type === "turn.completed") {
    console.log(`[turn completed] ${json(event.usage)}`);
  } else if (event.type === "turn.failed" || event.type === "error") {
    console.error(`[agent error] ${json(event)}`);
  }
}

function promptWithContext(prompt: string, schema: string, allowedTools: string[], systemPrompt?: string) {
  const courseNow = process.env.COURSE_NOW ?? "not set";
  return [
    "<ontology-schema>",
    schema,
    "</ontology-schema>",
    systemPrompt,
    `COURSE_NOW override date: ${courseNow}`,
    "Treat COURSE_NOW as the date for all time-relative reasoning about ontology data.",
    `You may use only these ontology MCP tools: ${allowedTools.join(", ")}.`,
    "Do not use Bash, shell, file-read, web, or any other tool or MCP server.",
    "## User request",
    prompt,
  ].join("\n\n");
}

export async function runAgent({ identity, prompt, tools, systemPrompt, options = {} }: RunAgentInput) {
  if (!tools.length) throw new Error("At least one ontology tool is required.");
  const allowedTools = tools.map((tool) => `mcp__ontology__${tool}`);
  const { server, dashboardConnected } = startWebServer();
  await Promise.race([
    dashboardConnected,
    new Promise<void>((resolve) => setTimeout(resolve, DASHBOARD_CONNECT_TIMEOUT_MS)),
  ]);
  const restoreFetch = installOntologyFetchInterceptor(identity);
  const sdk = startTelemetry();
  const tracer = trace.getTracer("fde-agents");
  const span = tracer.startSpan(identity, {
    attributes: {
      "langfuse.trace.name": identity,
      "langfuse.user.id": identity,
      "langfuse.observation.input": JSON.stringify({ prompt, tools }),
    },
  });
  const parentContext = trace.setSpan(context.active(), span);
  const toolSpans = new Map<string, Span>();

  try {
    const schema = await context.with(parentContext, () => buildSchemaBlock());
    const codex = new Codex({
      config: {
        mcp_servers: {
          ontology: {
            enabled: true,
            enabled_tools: tools,
            tools: Object.fromEntries(tools.map((tool) => [tool, { approval_mode: "approve" }])),
            command: process.execPath,
            args: ["--experimental-strip-types", mcpServer],
          },
        },
        web_search: "disabled",
        agents: { enabled: false },
      },
    });
    const thread = codex.startThread({
      model: options.model,
      workingDirectory: options.workingDirectory ?? process.cwd(),
      sandboxMode: options.sandboxMode ?? "read-only",
      networkAccessEnabled: true,
      approvalPolicy: "never",
    });

    const { events } = await context.with(parentContext, () =>
      thread.runStreamed(promptWithContext(prompt, schema, allowedTools, systemPrompt)),
    );
    let finalResponse = "";
    let usage: Usage | null = null;
    for await (const event of events) {
      publishEvent(event, { parentContext, tracer, toolSpans });
      renderToConsole(event);
      if (event.type === "item.completed" && event.item.type === "agent_message") finalResponse = event.item.text;
      if (event.type === "turn.completed") usage = event.usage;
    }
    span.setAttribute("langfuse.observation.output", JSON.stringify({ text: finalResponse, usage }));
    span.setStatus({ code: SpanStatusCode.OK });
    publish("final", { text: finalResponse, usage, threadId: thread.id });
    return { finalResponse, usage, threadId: thread.id };
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    publish("error", { message: String(error) });
    throw error;
  } finally {
    for (const toolSpan of toolSpans.values()) toolSpan.end();
    span.end();
    restoreFetch();
    await new Promise<void>((resolve) => setTimeout(resolve, DASHBOARD_GRACE_MS));
    clients.clear();
    await sdk.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

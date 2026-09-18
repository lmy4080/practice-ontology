import { serve } from "@hono/node-server";
import { Hono } from "hono";

import "./clock.ts";
import { db } from "./db.ts";
import { actionRoutes } from "./routes/actions.ts";
import { metaRoutes } from "./routes/meta.ts";
import { objectRoutes } from "./routes/objects.ts";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/objects", metaRoutes);
app.route("/api/objects", actionRoutes);
app.route("/api/objects", objectRoutes);

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Ontology server listening on http://localhost:${info.port}`);
});

export { app, db };

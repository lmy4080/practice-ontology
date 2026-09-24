## Conventions

- Use `pnpm add` to install libraries.
  Don't add packages by writing them directly into a `package.json`.
- The Neon Postgres connection string lives in `DATABASE_URL` in `.env` at the repository root.
- We use Node 22+, which can natively run `.ts` files without `tsx`, using `node --env-file=.env <file>.ts`.
- Kysely is used as a runtime query builder only, not as a migration or schema management tool. Schema changes go through SQL files applied with `pnpm run-sql`.
- An action has two halves: a handler in `apps/ontology/src/actions/...` and an `action_type` metadata row holding its `parameter_schema` (JSON Schema). The invoke route reads the metadata to validate and dispatch, so a handler with no row is unreachable and its audit write fails. Add both together, apply the metadata INSERT via a temporary SQL file applied with `run-sql` (not the read-only Neon MCP), and keep the schema and the handler's params in sync.
- Instance-table primary keys are text, holding domain IDs like `T-12` and `REC-LAGER-V3`. Not UUIDs or serial integers.
- Neon project name: `fastcampus-ontology` (sweet-recipe-60493604)
- When adding variables to .env, use `echo 'KEY=VALUE' >> .env` rather than editing the file. Editing exposes existing secrets in the diff and sends them through tool calls.
- The ontology server's clock is anchored to the system-level override date `COURSE_NOW`. The process's current time starts at the course's narrative date and advances from there.
- Whenever the Claude Code SDK would normally be used, use the OpenAI SDK instead and adapt the implementation to our project's architecture and requirements.
- Run agent files with the project root .env file.

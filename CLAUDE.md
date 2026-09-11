# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Code, comments, commit messages and UI strings are in **Brazilian Portuguese**, including identifiers (`exigirUsuario`, `umaLinha`, `novoId`, `consultar`). Match this when adding code — do not introduce English names into existing modules. Error messages returned to the client are user-facing Portuguese sentences.

## Commands

```bash
npm install

# Rodar localmente com um banco SQLite em arquivo (sem Turso, sem token):
TURSO_DATABASE_URL="file:./caderneta-local.db" node dev.mjs   # http://localhost:3000

vercel          # deploy de preview
vercel --prod   # produção
```

There is **no build step, no linter, no test suite, and no `scripts` field** in `package.json`. `node dev.mjs` is the only way to run the app locally. Changes to `api/` are picked up on the next request without restarting (`dev.mjs` cache-busts each dynamic import with `?t=<timestamp>`); changes to `dev.mjs` itself need a restart.

Running with a `file:` database means photos will not work locally — Vercel Blob needs `BLOB_READ_WRITE_TOKEN`. Everything else behaves identically.

## Architecture

A PWA for tracking car maintenance history, deployed on Vercel: static frontend + file-routed serverless functions, **Turso** (libSQL/SQLite) for data, **Vercel Blob** for receipt photos.

### Request path

`public/index.html` is the entire frontend — HTML, CSS and JS in one 1,500-line file with no build step, no framework and no dependencies. It talks to the API exclusively via `fetch("/api/...")` with cookie-based sessions.

Each file under `api/` is a Vercel function exporting `default async function handler(req, res)`. `dev.mjs` reimplements Vercel's file routing locally, including `[id].js` dynamic segments (populated into `req.query.id`) and `index.js` directory resolution — **keep `dev.mjs` in sync when adding route shapes**, since it is a hand-rolled imitation of the platform's behavior, not the real thing.

### Every protected route follows the same four-step shape

```js
if (!metodo(req, res, ["GET", "POST"])) return;   // 405 se o método não for permitido
const user = await exigirUsuario(req, res);       // 401 e devolve null se não houver sessão
if (!user) return;
// ... consultas SEMPRE com WHERE user_id = user.id
```

`exigirUsuario` writes the 401 itself and returns `null`; the caller must return immediately. `metodo` writes the 405 and returns `false`. This is the convention across all 11 routes — follow it exactly rather than inventing per-route auth.

### Tenant isolation is enforced per-query, never by trusting the client

This is the single most important invariant in the codebase. The user id comes **only** from the session cookie, never from the request body or URL. Every read, update and delete carries `AND user_id = ?` — including `UPDATE`/`DELETE` statements, which is what prevents one account from editing or deleting another's rows even when an id is guessed. When a row is not found under the caller's `user_id`, routes return **404, not 403**, so existence is not leaked.

When adding a query touching `vehicles`, `maintenances`, `refuels`, `sessions` or `invites`, the `user_id` filter is mandatory — an ownership check followed by an unfiltered write is a security bug, not a style issue.

### Layers

- `lib/db.js` — lazy libSQL client plus `migrar()`, which runs `CREATE TABLE IF NOT EXISTS` on first use of each function instance and memoizes with a module-level flag. **The schema lives here as a `TABELAS` array; there are no migration files.** Adding a column means editing that DDL — and since `IF NOT EXISTS` will not alter an existing table, an added column needs a manual `ALTER TABLE` against any live database. Use the `consultar` / `executar` / `umaLinha` helpers rather than `db()` directly; they call `migrar()` for you.
- `lib/auth.js` — scrypt password hashing (stored as `scrypt$N$r$p$salt$hash`, verified with `timingSafeEqual`), opaque random session tokens in a `sessions` table, and the `caderneta_sessao` HttpOnly/SameSite=Lax cookie (60 days, `Secure` only when `NODE_ENV=production`). Expired sessions are deleted on read.
- `lib/http.js` — `responder`/`erro` JSON helpers, `lerCorpo` (handles both Vercel's parsed `req.body` and raw streams, returning `{}` on malformed JSON), cookie parsing, and the coercers `texto`/`inteiro`/`decimal`/`dataISO`. All input is run through these coercers, which clamp length and never throw — validation is defensive coercion, not schema rejection.
- `lib/mapear.js` — the boundary between snake_case DB columns and the camelCase JSON the frontend consumes (`km_atual` → `kmAtual`). **Rows are never returned raw**; a new field needs mapping added here or it will not reach the client.
- `lib/fotos.js` — accepts only `data:` URLs of jpeg/png/webp up to 3 MB, uploads to Blob with a random suffix. `apagarBlob` deliberately swallows errors so a missing photo never breaks the surrounding operation.

### Photos are proxied, never linked

Blob objects are technically `access: "public"`, but the URL is unguessable and **never sent to the browser**. `manutencaoParaApp` exposes only a boolean `temFoto`; the client requests `/api/photos/<id>`, which verifies the session and row ownership, then streams the bytes back. Do not expose `foto_url` in any API response — that would bypass the auth gate entirely.

### First account, then invite-only

`api/auth/register.js` allows the very first account with no invite (`existeAlgumUsuario()` is false); every subsequent registration requires an unused, unexpired code from the `invites` table. Codes are single-use, uppercased, and marked used via a conditional `UPDATE ... WHERE usado_por IS NULL`.

## Environment variables

`TURSO_DATABASE_URL` (required; accepts a `libsql://` URL or a local `file:` path), `TURSO_AUTH_TOKEN` (required for Turso, omit for `file:`), and `BLOB_READ_WRITE_TOKEN` (injected automatically by Vercel once the Blob store is connected). See `.env.example`.

## Deployment notes

`vercel.json` sets a 15s function `maxDuration`, `Cache-Control: no-store` on all `/api/*` responses, and `nosniff` / `same-origin` / `DENY` security headers site-wide. When first running `vercel`, decline the offer to overwrite settings — the committed `vercel.json` is authoritative.

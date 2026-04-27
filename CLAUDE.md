# amtocbot-site Codebase Guide

Angular 21.2 SPA + Cloudflare Pages Functions backend. D1 SQLite via `env.ENGAGE_DB`.

## Stack Quick-Reference

- **Frontend:** Angular 21.2, Angular Material, standalone components, signals
- **Backend:** Cloudflare Pages Functions (`functions/api/**/*.ts`), file-based routing
- **DB:** D1 (SQLite), migrations in `migrations/`, applied via `wrangler d1 execute`
- **Auth:** Session cookie `engage_session`, `getSessionUser(request, env.ENGAGE_DB)` → `requirePermission(user, perm)`
- **Build:** `npx ng build && cp dist/.../index.csr.html dist/.../index.html`
- **Deploy:** `npx wrangler pages deploy dist/amtocbot-site/browser --project-name=amtocbot-site`

## Key Conventions

- All API responses use `jsonResponse(body, status)` from `functions/api/_shared/auth.ts`
- Permission check pattern: `const deny = requirePermission(user, 'perm.name'); if (deny) return deny;`
- User ID field is `user.user_id` (not `user.id`)
- QA endpoints re-export from `functions/api/dashboard/qa/_shared.ts`
- Angular services use `inject(HttpClient)` pattern (not constructor injection)

## Codebase Knowledge Graph

A `graphify-out/GRAPH_REPORT.md` file is committed at the root of this repo. It contains a structured map of every Angular component, service, Cloudflare Pages Function, and migration — their relationships and dependencies.

**Before searching for a file or function**, read `graphify-out/GRAPH_REPORT.md` first. It will point you directly to the right file, saving grep-across-400-TypeScript-files searches.

The graph updates automatically via PostToolUse hook after every file write. To manually refresh: `/Users/amtoc/.local/bin/graphify update . --exclude node_modules --exclude dist` from the repo root.

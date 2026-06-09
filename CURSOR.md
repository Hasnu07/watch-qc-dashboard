# Purosangue QC Dashboard — Cursor / AI Agent Guide

A real-time quality-control dashboard for a luxury watch trading business.
Tracks watches through a Logistics → Accounting → Sales pipeline, auto-imports
buy/sell deals from a WhatsApp group, and assigns tasks to team members.
Runs on a TV screen in the office plus phones/laptops.

> Read this whole file before editing. The **Critical Gotchas** section exists
> because each item already caused a production outage. Don't relearn them.

---

## 1. Stack

| Layer | Tech |
|---|---|
| Framework | **Next.js 14 (App Router)**, TypeScript strict |
| DB | **PostgreSQL on Supabase** (was Neon — migrated) |
| ORM | **Prisma 5** (`prisma db push`, NOT migrations) |
| Styling | Tailwind CSS (custom theme tokens: `bg-ink`, `text-muted`, `bg-panel`, `bg-card`, `btn-primary`, etc. — see `app/globals.css`) |
| Realtime | Server-Sent Events (`/api/sse`) + polling fallback |
| WhatsApp | **GreenAPI** (outbound messages + inbound webhook) |
| AI parsing | **Rule-based** (regex) — NO API key needed. See `lib/parse-whatsapp-watch.ts` |
| Hosting | **Render** (auto-deploys `main`), build via `scripts/render-build.sh` |
| Live URL | https://qc-dashboard-q907.onrender.com |

---

## 2. Run locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # prisma generate && next build (run before pushing)
npx tsc --noEmit     # typecheck
```

`.env` needs `DATABASE_URL` (Supabase pooler URL — see §6). It's gitignored.
`ANTHROPIC_API_KEY` is optional now (parsing is rule-based).

Useful scripts:
- `node scripts/seed-member-logins.mjs` — create/refresh team logins
- `node scripts/find-client-prisma.mjs` — **run before deploy**: detects any
  `'use client'` file that transitively imports Prisma (a fatal bug class, see §5)

---

## 3. Data model (`prisma/schema.prisma`)

- **Watch** — inventory item. Key fields: `watch_type` (`'BUY'` | `'SELL'` | legacy `'BUY_SELL'`), `is_sold`, `stage` (LOGISTICS/ACCOUNTING/SALES), `stock_no`, `bought_from`, `sold_to`, `payment_status`, `location_status`, `image_url`, `linked_buy_watch_id` (a SELL watch links back to its BUY watch), `fob_url`.
- **WatchTask** — per-watch task. `phase` (`'BUY'`|`'SELL'`), `task_type` (string key OR label), `is_completed`, `is_locked`, `assigned_to` (member name string), `department`.
- **TaskTemplate** — configurable task definitions (buy & sell). `default_assignee`. Seeded from `lib/sell-task-templates.ts` constants.
- **TeamMember** — `name`, `whatsapp_number` (**UNIQUE** — two members can't share a number), `department`, `login_username`, `password_hash`, `role` (`MEMBER`|`MASTER`).
- **Task** — ad-hoc admin tasks assigned between members (the home `/` page).
- **WatchActivity** — audit log per watch. **ImportInbox** — parked WhatsApp messages the parser skipped. **WatchPayment**, **MemberSession**, **Setting**.

Watch lifecycle: BUY watch added → 13 buy tasks created. Stays on dashboard
until all active-phase tasks complete (`lib/watch-visibility.ts`). SELL watch
added → 6 sell tasks. "Task Done" / all-tasks-complete removes it from the board.

---

## 4. Routes

**Pages** (`app/*/page.tsx`): `/` (Team/admin tasks — home), `/dashboard`
(watch pipeline + task panels), `/pending` (triage by person), `/history`,
`/settings`, `/login` (now just redirects — see §7). **`/slideshow` was removed.**

**Key APIs** (`app/api/*/route.ts`):
- `watches`, `watches/[id]`, `watches/import-from-message`, `watches/[id]/fetch-image`, `watches/bulk-fetch-images`, `watches/export`
- `watch-tasks`, `watch-tasks/[id]` (PATCH toggles completion + emits SSE)
- `task-templates`, `task-templates/[id]`
- `tasks`, `tasks/[id]`, `tasks/[id]/ring` (WhatsApp reminder), `tasks/[id]/not-completed`
- `team-members`, `team-members/[id]` (PATCH = edit name/number; rejects duplicate numbers with 409)
- `pending-tasks-by-member` (drives `/pending`)
- `webhook/greenapi` (inbound WhatsApp auto-import), `whatsapp/recent-activity`, `whatsapp/recent-groups`
- `settings`, `settings/test-whatsapp`, `sse`, `health`, `wakeup` (DB keep-alive)
- `auth/*` (login/logout/me/profiles — **mostly inert now, see §7**)

---

## 5. ⚠️ CRITICAL GOTCHAS (each caused a prod outage)

### 5.1 NEVER import server-only code into a `'use client'` component
A client component that transitively imports `lib/prisma` (or anything importing
it) bundles **PrismaClient into the browser** → React throws
`"PrismaClient is unable to run in this browser environment"` → **blank page**.

- This bit us via `client component → lib/task-labels → lib/sell-tasks → lib/prisma`.
- Fix pattern: keep plain-data constants in a **prisma-free** file
  (`lib/sell-task-templates.ts`) and import those from client code. Server files
  re-export them.
- `next.config.js` has a guard aliasing `@prisma/client` to `false` on the client,
  and there's an `ErrorBoundary` in `app/layout.tsx`, but **don't rely on those** —
  fix the import chain.
- **Before any deploy that touches client/lib files, run
  `node scripts/find-client-prisma.mjs`** — it traces every client file and fails
  if one reaches Prisma.

### 5.2 Supabase connection limit — cap Prisma's pool
The Supabase **session pooler caps total clients at 15**. Prisma's default pool
exhausted it → `FATAL: max clients reached` → 500s everywhere (pending API died →
slideshow showed "All caught up", pages crashed).

- `lib/prisma.ts` injects `connection_limit=5&pool_timeout=30` into the URL.
  **Do not remove this.** If you add more DB-heavy concurrency, keep total
  connections under 15.
- The Prisma client also has retry middleware for transient connection errors
  (cold start + "max clients reached"). Keep new transient DB errors in that
  pattern list.

### 5.3 Render auto-deploy can silently stall
Several times Render did not pick up pushes. Symptoms: production keeps serving
an old chunk hash. To verify what's actually live:
```bash
curl -s https://qc-dashboard-q907.onrender.com/ | grep -oE "page-[a-z0-9]+\.js"
```
Compare to your local `.next/static/chunks/app/page-*.js`. If stuck: in Render →
**Manual Deploy → Clear build cache & deploy**, or push an empty commit
(`git commit --allow-empty`). Check the **Events** tab for failures.

### 5.4 Build can't depend on the DB
`scripts/render-build.sh` is **DB-free by default** (`RUN_DB_JOBS_ON_BUILD=0`).
Don't add `prisma db push` / seeds to the default build path — if the DB is
unreachable the whole deploy fails. Schema changes: run `npx prisma db push`
manually against Supabase, or set `RUN_DB_JOBS_ON_BUILD=1` for one deploy.

### 5.5 Hydration: keep server & client first render identical
Auth-state that differed between SSR (static) and client caused a fatal
hydration mismatch in production (worked in dev). `<html>`/`<body>` have
`suppressHydrationWarning`. Avoid rendering different DOM structure based on
client-only data during first paint.

---

## 6. Database (Supabase)

- Project ref: `tjwbcszkxuvgyjlrbjpq`, region `aws-1-us-east-1`.
- Connection string is the **session pooler** (port 5432):
  `postgresql://postgres.tjwbcszkxuvgyjlrbjpq:<PWD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`
- Set in **Render → Environment → `DATABASE_URL`** and local `.env`.
- Schema changes: edit `prisma/schema.prisma` → `npx prisma db push` (NOT migrate).
- `/api/wakeup` exists for an external uptime monitor to keep the DB warm.
- Note: the **direct** host `db.<ref>.supabase.co:5432` is IPv6-only and fails on
  Render (IPv4). Always use the **pooler** host.

---

## 7. ⚠️ Authentication is REMOVED

Login was fully disabled (it was causing hydration crashes; product decision to
drop it). Current behaviour:
- `hooks/useCurrentMember` always returns a synthetic **Master** user, no fetch.
- `lib/auth` `getSessionMember`/`requireSession` fall back to a master user —
  every API and page is open, never 401.
- `middleware.ts` is a pass-through (no redirects).
- `/login` just redirects to `/dashboard`.

**If you re-introduce auth:** revert these four files together, restore the
middleware matcher gate, and re-test the logged-out hydration path in a
**production build** (`npm run build && npm start`), not just dev — the crash
only reproduced in prod.

---

## 8. WhatsApp auto-import

- Inbound webhook: `app/api/webhook/greenapi/route.ts`. GreenAPI must point to
  `<live-url>/api/webhook/greenapi`.
- Only messages from the configured group import. Group is hardcoded as a
  fallback (`120363420701421193@g.us`, "Purosangue team BUY AND SELL") and
  overridable via Settings (`whatsapp_stock_group_id` / `_name`).
- Parsing is **rule-based** (`lib/parse-whatsapp-watch.ts`) — handles structured
  cards ("Seller: …\nModel: …\nReference: …\nPurchase Price: … euro") and informal
  sells ("Sold 1250 to X for 55.000 gbp"). Detects BUY vs SELL, brand/model/ref/
  stock/price/currency/payment status.
- Skipped/ambiguous messages go to **ImportInbox** (reviewable in the dashboard),
  not silently dropped.
- Manual catcher: the **📋 Paste** button on `/dashboard` runs the same import
  on pasted text. Shared logic in `lib/import-watch-from-message.ts`.
- Outbound (task notifications, reminders) via `lib/greenapi.ts`; GreenAPI creds
  live in Settings (`greenapi_instance_id`, `greenapi_api_token`, `greenapi_api_url`).

---

## 9. Conventions

- Theme tokens only (`text-ink`, `bg-panel`, `btn-primary`, …) — don't hardcode
  raw slate/indigo colors; match `app/globals.css`.
- API routes: `export const dynamic = 'force-dynamic'` for anything reading the DB.
- Mutations that should update other clients live → `emitWatchEvent` /
  `emitWatchTaskEvent` (`lib/events.ts`); the dashboard listens via SSE.
- Member identity is by **name string** in `assigned_to` (case-insensitive match
  via `namesMatch`), not by id — be careful renaming members.
- Always `npm run build` before pushing; CI is the Render build.

---

## 10. Workflow

1. Branch off `main` (or edit directly if that's the team norm).
2. Make changes; `npm run build` + `npx tsc --noEmit` clean.
3. If you touched client/lib files: `node scripts/find-client-prisma.mjs`.
4. Commit, push to `main` → Render auto-deploys.
5. Verify live: check the chunk hash changed (§5.3), hard-refresh the TV screen.

End commit messages with the standard co-author trailer if your tooling adds one.

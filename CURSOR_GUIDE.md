# Watch QC Dashboard — Full Project Guide for Cursor / Claude

> **Live URL:** https://qc-dashboard-q907.onrender.com  
> **GitHub:** https://github.com/Hasnu07/watch-qc-dashboard  
> **Stack:** Next.js 14 · Prisma · PostgreSQL · GreenAPI WhatsApp · Render  
> **Deploy:** Auto-deploy on every push to `main`

---

## What This App Does

An internal operations dashboard for a luxury watch trading company (Purosangue). It:

1. **Auto-imports watches** from a WhatsApp group — when someone posts a purchase/sale message, GreenAPI sends a webhook to this app, which parses it with regex and adds the watch to the database automatically.
2. **Tracks every watch** through a 3-department pipeline (Logistics → Accounting → Sales) with per-department task checklists.
3. **Sends WhatsApp notifications** — when tasks are assigned, when reminders fire, when a task is "ringed", and when someone reports a task is not done.
4. **Admin task board** — managers can assign free-text tasks to team members with WhatsApp delivery and recurring reminders.
5. **History** — completed/sold watches are archived.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, fullstack) |
| Language | TypeScript (strict mode) |
| ORM | Prisma 5 |
| Database | PostgreSQL (hosted on Render) |
| Styling | Tailwind CSS v3 (glassmorphism dark theme) |
| WhatsApp | GreenAPI (REST API + webhook) |
| Hosting | Render (auto-deploy from GitHub main) |
| Real-time | Server-Sent Events (SSE) |
| Scheduler | node-cron (runs inside Next.js via instrumentation.ts) |

**No AI / No paid APIs.** Anthropic SDK is still in package.json but is unused — all AI was replaced with free regex/keyword/static-lookup alternatives.

---

## Directory Structure

```
watch-qc-dashboard/
│
├── app/                          # Next.js App Router pages + API routes
│   ├── globals.css               # Global styles: dark bg, glass utilities, neon glows, animations
│   ├── layout.tsx                # Root layout: NavBar wrapper, dark body
│   │
│   ├── page.tsx                  # /  →  Admin Tasks page
│   ├── dashboard/page.tsx        # /dashboard  →  Watch inventory + task panels
│   ├── history/page.tsx          # /history  →  Sold/completed watches
│   ├── settings/page.tsx         # /settings  →  Team, WhatsApp, task defaults
│   ├── login/page.tsx            # /login  →  Password gate
│   │
│   └── api/                      # All backend API routes (REST)
│       ├── ai/
│       │   ├── parse-whatsapp-watch/route.ts   # POST: parse raw WhatsApp text → watch fields (regex, no AI)
│       │   └── watch-autofill/route.ts         # POST: ref_no → watch spec (static lookup table, no AI)
│       │
│       ├── auth/
│       │   ├── login/route.ts    # POST: password check → sets qc_admin_session cookie
│       │   └── logout/route.ts   # POST: clears session cookie
│       │
│       ├── cron/
│       │   ├── morning-messages/route.ts  # POST: sends morning WhatsApp reminders to team
│       │   └── backfill-tasks/route.ts    # POST: adds missing default tasks to existing watches (safe to re-run)
│       │
│       ├── settings/
│       │   ├── route.ts               # GET/POST: read/write settings table (GreenAPI creds, etc.)
│       │   └── test-whatsapp/route.ts # POST: sends test message to all team members
│       │
│       ├── sse/route.ts              # GET: Server-Sent Events stream (real-time dashboard updates)
│       ├── health/route.ts           # GET: health check
│       │
│       ├── tasks/                    # Admin Tasks (free-text tasks between team members)
│       │   ├── route.ts              # GET all tasks / POST create task
│       │   └── [id]/
│       │       ├── route.ts          # PATCH: mark complete/incomplete
│       │       ├── ring/route.ts     # POST: send WhatsApp "ring" to assignee
│       │       └── not-completed/route.ts  # POST: send not-done reason to assigner
│       │
│       ├── task-templates/           # Reusable task templates (BUY/SELL defaults)
│       │   ├── route.ts              # GET all / POST create custom template
│       │   └── [id]/route.ts         # PATCH update assignee / DELETE remove
│       │
│       ├── team-members/             # Team member CRUD
│       │   ├── route.ts              # GET all / POST create
│       │   └── [id]/route.ts         # DELETE
│       │
│       ├── watch-tasks/              # Per-watch department tasks (checklist items)
│       │   ├── route.ts              # GET all with filters
│       │   ├── history/route.ts      # GET completed tasks history
│       │   └── [id]/
│       │       ├── route.ts          # PATCH: toggle complete, update assigned_to, metadata
│       │       └── unlock/route.ts   # POST: manually unlock a locked task
│       │
│       ├── watches/                  # Watch CRUD + sub-resources
│       │   ├── route.ts              # GET all active / POST create watch
│       │   ├── import-from-message/route.ts  # POST: parse WhatsApp text → create watch
│       │   └── [id]/
│       │       ├── route.ts          # GET / PATCH / DELETE
│       │       ├── assign-tasks/route.ts    # POST: re-assign all tasks for this watch
│       │       ├── location/route.ts        # PATCH: update location status/from/to
│       │       ├── payment-status/route.ts  # PATCH: update payment + auto-unlock location task
│       │       └── payments/route.ts        # GET/POST: individual payment records
│       │
│       ├── webhook/
│       │   └── greenapi/route.ts     # POST: receives all WhatsApp messages from GreenAPI
│       │
│       └── whatsapp/
│           ├── recent-activity/route.ts  # GET: last 25 webhook hits (for settings debug UI)
│           └── recent-groups/route.ts    # GET: all WhatsApp groups seen recently
│
├── components/                   # Reusable React components
│   ├── NavBar.tsx               # Top navigation bar (glass morphism)
│   ├── WatchCard.tsx            # Watch card shown in the inventory grid
│   ├── WatchTaskPanel.tsx       # Right panel: BUY watch task checklists
│   ├── WatchSellTaskPanel.tsx   # Right panel: SELL watch task checklists
│   ├── WatchDetailModal.tsx     # Full-screen watch detail/edit modal
│   ├── AddWatchModal.tsx        # Modal to manually add a watch
│   ├── PasteMessageModal.tsx    # Modal to paste a WhatsApp message for import
│   ├── TaskCard.tsx             # Individual task card in WatchTaskPanel
│   └── AutoScrollList.tsx       # Wraps children in an auto-scrolling container
│
├── lib/                          # Shared business logic (used by API routes)
│   ├── prisma.ts                # Singleton Prisma client
│   ├── greenapi.ts              # sendWhatsAppMessage(), toChatId(), fromChatId()
│   ├── watch-tasks.ts           # createWatchTasks(), assignWatchTasks(), sendPendingTaskReminders(), checkAndUnlockLocation()
│   ├── sell-tasks.ts            # createWatchSellTasks(), ensureDefaultTemplates(), DEFAULT_BUY_TEMPLATES, DEFAULT_SELL_TEMPLATES
│   ├── import-watch-from-message.ts  # importWatchFromMessage() — shared between webhook + paste UI
│   ├── parse-whatsapp-watch.ts  # parseWhatsAppWatch() — pure regex parser, synchronous, no AI
│   ├── claude.ts                # estimateTaskMinutes() — keyword-based estimator (no AI)
│   ├── cron.ts                  # startCronJobs() — schedules the 3-hour reminder cron
│   ├── events.ts                # Node.js EventEmitter for SSE (emitWatchEvent, emitWatchTaskEvent, etc.)
│   ├── utils.ts                 # formatCurrency() and other helpers
│   └── webhook-activity.ts      # In-memory log of recent webhook hits + group tracking
│
├── prisma/
│   └── schema.prisma            # Database schema (see Models section below)
│
├── instrumentation.ts           # Next.js instrumentation hook — starts node-cron on server startup
├── middleware.ts                 # Auth middleware — protects /dashboard, /history, /settings
├── next.config.js               # Next.js config (image domains, webpack alias)
├── tailwind.config.ts           # Tailwind config (custom colors, font)
├── postcss.config.js            # PostCSS config (tailwind + autoprefixer)
└── tsconfig.json                # TypeScript config (strict: true, moduleResolution: bundler)
```

---

## Database Models (Prisma Schema)

### Watch
The core entity. Represents a single watch being bought or sold.

| Field | Type | Notes |
|---|---|---|
| `id` | Int PK | |
| `name` | String | Auto-generated from brand + model |
| `brand`, `model`, `ref_no`, `serial_no`, `stock_no` | String? | |
| `watch_date` | String? | Year/date on the watch |
| `bought_from`, `sold_to` | String? | |
| `currency` | String | USD/EUR/AED/GBP/HKD |
| `purchase_price` | Decimal? | |
| `website_price`, `b2b_price` | Decimal | |
| `watch_type` | String | `"BUY"` or `"SELL"` (default `"BUY_SELL"` for old records) |
| `stage` | WatchStage enum | `LOGISTICS` → `ACCOUNTING` → `SALES` |
| `is_sold` | Boolean | |
| `payment_status` | PaymentStatus enum | `NOT_PAID` / `PARTIAL` / `PAID` |
| `location_status` | LocationStatus enum | `INCOMING` / `IN_TRANSIT` / `IN_STOCK` |
| `location_from`, `location_to` | String? | |
| `image_url` | String? | Direct image URL |
| `case_material`, `dial_colour`, `bracelet` | String? | |

### WatchTask
One checklist item per watch per task. Each watch gets 14 default BUY tasks on creation.

| Field | Type | Notes |
|---|---|---|
| `watch_id` | Int FK | |
| `department` | TaskDepartment enum | `ACCOUNTING` / `SALES` / `LOGISTICS` |
| `task_type` | String | e.g. `LOGISTICS_SET_LOCATION` |
| `phase` | String | `"BUY"` |
| `is_completed` | Boolean | |
| `assigned_to` | String? | Team member name |
| `is_locked` | Boolean | Location task starts locked until payment confirmed |

### Task
Free-text admin tasks assigned from one person to another.

| Field | Type | Notes |
|---|---|---|
| `team_member_id` | Int FK | Who will do the task |
| `assigned_by_id` | Int? FK | Who gave the task |
| `message_text` | String | Task description |
| `is_completed` | Boolean | |
| `reminder_interval_minutes` | Int? | 60 / 180 / 1440 / custom |
| `estimated_minutes` | Int? | Estimated duration |

### TaskTemplate
Reusable task definitions (BUY or SELL phase). Built-in ones are protected from deletion.

### TeamMember
Each person in the team with their WhatsApp number and department.

### Setting
Key-value store for app config (GreenAPI credentials, etc.).

---

## Key Enums

```prisma
enum TaskDepartment { ACCOUNTING  SALES  LOGISTICS }
enum Department     { ACCOUNTING  SALES  LOGISTICS }   // for TeamMember
enum WatchStage     { LOGISTICS  ACCOUNTING  SALES }
enum PaymentStatus  { NOT_PAID  PARTIAL  PAID }
enum LocationStatus { INCOMING  IN_TRANSIT  IN_STOCK }
```

> ⚠️ **TypeScript gotcha:** When passing department values to Prisma `createMany`, you MUST use `'ACCOUNTING' as const` (not plain `'ACCOUNTING'`). Prisma's TypeScript types expect the enum literal type, not `string`. Failing to do this causes strict-mode build errors.

---

## Default Watch Tasks (14 tasks per BUY watch)

When a watch is created (`createWatchTasks()` in `lib/watch-tasks.ts`):

| Department | Task Key | Locked? |
|---|---|---|
| ACCOUNTING | `ACCOUNTING_MARK_PAYMENT` | No |
| ACCOUNTING | `ACCOUNTING_ADD_STOCK_FOB` | No |
| SALES | `SALES_SET_PRICE` | No |
| SALES | `SALES_UPLOAD_DRIVE` | No |
| SALES | `SALES_UPLOAD_STOCK_GROUP` | No |
| SALES | `SALES_UPDATE_B2B` | No |
| SALES | `SALES_GET_B2C_PRICES` | No |
| LOGISTICS | `LOGISTICS_SET_LOCATION` | **Yes** (unlocks when payment ≥ PARTIAL) |
| LOGISTICS | `LOGISTICS_UPDATE_COST` | No |
| LOGISTICS | `LOGISTICS_ACCESSORIES_BOX` | No |
| LOGISTICS | `LOGISTICS_ACCESSORIES_PAPERS` | No |
| LOGISTICS | `LOGISTICS_ACCESSORIES_EXTRA_LINKS` | No |
| LOGISTICS | `LOGISTICS_ACCESSORIES_WARRANTY_CARD` | No |
| LOGISTICS | `LOGISTICS_ACCESSORIES_HANG_TAG` | No |

---

## WhatsApp Auto-Import Flow

```
WhatsApp Group Message
    ↓
GreenAPI detects message in "Purosangue team BUY AND SELL" group
    ↓
POST /api/webhook/greenapi
    ↓
Checks: is this the right group? (by hardcoded ID: 120363420701421193@g.us OR name match)
    ↓
Extracts caption from: fileMessageData.caption / captionText / text / videoMessageData / textMessageData / extendedTextMessageData
    ↓
Calls importWatchFromMessage(text, imageUrl)
    ↓
parseWhatsAppWatch(text) — pure regex, synchronous, no AI
    ├── Detects BUY vs SELL via /\bsold\s+(\d+\s+)?to\b/i
    ├── Extracts: brand, model, ref_no, stock_no, price, currency, payment_status
    ├── Extracts: bought_from / sold_to, location_status, location_from/to
    └── Returns: { should_import, type, brand, model, ... }
    ↓
If SELL + stock_no found: update existing watch (is_sold=true, sold_to, price)
If BUY or new SELL: create new Watch record
    ↓
createWatchTasks() or createWatchSellTasks()
    ↓
Notify assigned team members via WhatsApp
    ↓
emitWatchEvent() → SSE → Dashboard updates live
```

---

## WhatsApp Notification Types

All sent via `lib/greenapi.ts → sendWhatsAppMessage()`. GreenAPI credentials stored in the `Setting` table.

| Trigger | Who Gets It | Function |
|---|---|---|
| New watch added (BUY) | Each assigned team member | `notifyAssignedPersons()` in watch-tasks.ts |
| New watch added (SELL) | Each assigned team member | same in sell-tasks.ts |
| Payment confirmed (PARTIAL/PAID) | LOGISTICS dept | `checkAndUnlockLocation()` |
| Task completed | The dept that owns the task | `sendTaskCompletedNotification()` |
| 🔔 Ring button pressed | The task assignee | POST `/api/tasks/[id]/ring` |
| ⚠️ Not Done submitted | The task assigner | POST `/api/tasks/[id]/not-completed` |
| Cron (every 3 hrs) | Each person with pending tasks | `sendPendingTaskReminders()` |
| Morning cron | All team members | POST `/api/cron/morning-messages` |

---

## Real-Time Updates (SSE)

`GET /api/sse` opens a persistent Server-Sent Events connection. The dashboard subscribes to it on load.

- `lib/events.ts` exports a singleton `EventEmitter` (stored on `globalThis`)
- Any API route calls `emitWatchEvent()` / `emitWatchTaskEvent()` after mutating data
- SSE route listens and streams the event to all connected browsers
- Dashboard re-fetches `/api/watches` on any event
- Falls back to 10-second polling if SSE connection drops

---

## Auth / Session

- Password is hardcoded in `app/api/auth/login/route.ts`
- On success, sets an `httpOnly` cookie `qc_admin_session`
- `middleware.ts` guards `/dashboard`, `/history`, `/settings`
- `/` (Admin Tasks) is intentionally **public** — team can view tasks without logging in

---

## Cron Jobs

`instrumentation.ts` runs on server startup (Next.js instrumentation hook):
- Only activates when `NEXT_RUNTIME === 'nodejs'` and not on Vercel
- Calls `startCronJobs()` from `lib/cron.ts`
- Schedules: `sendPendingTaskReminders()` every 3 hours (`0 */3 * * *`)

Additional cron endpoint: `POST /api/cron/morning-messages` (can be triggered manually or by Render scheduled job)

---

## UI Pages

### `/` — Admin Tasks (public)
- Assign free-text tasks from one person to another
- Optional WhatsApp reminder intervals: 60 min / 3 hrs / 24 hrs / custom (type any minutes)
- Per-task **🔔 Ring** button → sends WhatsApp ping to assignee
- Per-task **⚠️ Not Done** button → inline form to type reason → sends to assigner via WhatsApp
- Filter: All / Pending / Done

### `/dashboard` — Watch Inventory + Tasks (protected)
- **Left panel:** Watch card grid — department progress pipeline, payment badge, location badge, image, prices
- **Right panel:** Task checklists per watch, grouped by department
- Tab switcher: Buy Tasks / Sell Tasks
- Auto-scrolling task list
- Real-time via SSE (falls back to polling)
- "+ Add Watch" manual modal
- "📋 Paste" modal — paste any WhatsApp message, app parses and imports it

### `/history` — Watch Archive (protected)
- Sold/completed watches

### `/settings` — Configuration (protected)
- GreenAPI credentials (instance ID, token, API URL)
- Team members (name, WhatsApp number, department)
- Task assignment defaults — which person handles each task type by default
- Test WhatsApp button — sends test message to all team members
- Webhook activity log — last 25 messages received and their import outcome
- Seen WhatsApp groups — for picking the right stock group

---

## lib/parse-whatsapp-watch.ts — Key Logic

Pure regex parser, no AI. Handles messages like:

```
Brand: Rolex
Model: Daytona
Ref: 126500LN
Stock No: 1234
Price: 35,000 USD
From: Ahmed Dubai
```

And sell messages like:
```
Sold 1347 to Ali Akawi for 350.000 aed
Paid wire in wio business
Watch is delivered
```

Key regex patterns:
- BUY detection: has labelled fields (Brand:, Model:, Price:, etc.)
- SELL detection: `/\bsold\s+(\d+\s+)?to\b/i`
- `sold_to` capture: stops before "for [price]" — e.g. "Sold 1347 to Ali Akawi for 350 USD" → `sold_to = "Ali Akawi"`
- Currency: detects USD / EUR / AED / GBP / HKD from text
- Payment status: "paid wire", "paid cash", "paid bank" → PAID; "partial" → PARTIAL

---

## Deployment (Render)

- **Service type:** Web Service
- **Build command:** `npm install && npm run build` (which runs `prisma generate && next build`)
- **Start command:** `npm start`
- **Branch:** `main` — every `git push origin main` triggers auto-deploy
- **Environment variables** set in Render dashboard:
  - `DATABASE_URL` — PostgreSQL connection string
  - `ADMIN_PASSWORD` — login password
  - `NEXTAUTH_SECRET` or similar session secret

> **Deploy time:** ~2–3 minutes. Check Render dashboard for status.  
> **If build fails:** Most likely a TypeScript strict-mode error. Run `node_modules/.bin/tsc --noEmit` locally or check Render deploy logs.

---

## Common Patterns & Rules for Editing

### 1. Prisma enum fields need `as const`
```typescript
// ✅ CORRECT
{ department: 'ACCOUNTING' as const, ... }

// ❌ WRONG — causes TypeScript build error (string ≠ TaskDepartment enum)
{ department: 'ACCOUNTING', ... }
```

### 2. Adding a new default task
Three places must all be updated:
1. `lib/watch-tasks.ts` — `WATCH_TASKS` array + `TASK_LABELS` record
2. `app/api/cron/backfill-tasks/route.ts` — `DEFAULT_TASKS` array
3. `app/settings/page.tsx` — `TASK_DEFAULT_ROWS` array

### 3. Adding a new API route
Create `app/api/your-route/route.ts` with named exports:
```typescript
export async function GET(req: NextRequest) { ... }
export async function POST(req: NextRequest) { ... }
export async function PATCH(req: NextRequest) { ... }
```

### 4. Emitting real-time events after DB mutations
```typescript
import { emitWatchEvent } from '@/lib/events'
emitWatchEvent({ type: 'watch_updated', watchId: id })
```

### 5. Sending WhatsApp messages
```typescript
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'
// Get credentials from DB first
const settings = await getGreenAPISettings() // in lib/watch-tasks.ts
await sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(number), message, settings.apiUrl)
```

### 6. CSS class conventions (dark glassmorphism theme)
```css
/* Glass cards */
.glass       /* bg-white/5.5 + backdrop-blur-20 + border-white/10 */
.glass-md    /* bg-white/8  + backdrop-blur-24 + border-white/13 */
.glass-strong /* bg-white/11 + backdrop-blur-32 + border-white/17 */

/* Neon glows */
.glow-cyan .glow-violet .glow-pink .glow-green .glow-amber

/* Gradient text */
.text-gradient      /* cyan → violet → pink */
.text-gradient-cyan /* cyan → indigo */
.text-gradient-gold /* amber → orange */
```

In Tailwind classes, use opacity variants for dark theme:
- Text: `text-white/90` (primary), `text-white/60` (secondary), `text-white/35` (muted)
- Borders: `border-white/10` (default), `border-white/20` (hover)
- Backgrounds: `bg-white/[0.06]` (cards), `bg-white/[0.10]` (hover)
- Dept colors: cyan (Logistics), amber (Accounting), emerald (Sales)

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (set on Render) |
| `ADMIN_PASSWORD` | Dashboard login password |
| `NEXT_RUNTIME` | Set to `nodejs` by Next.js automatically on server |

GreenAPI credentials (instanceId, token, apiUrl) are stored in the **database** `Setting` table — not environment variables — so they can be changed from the UI without redeploying.

---

## What Was Replaced / Removed

The project originally used Claude AI (Anthropic) for:
1. **Watch parsing** — replaced with `lib/parse-whatsapp-watch.ts` (pure regex)
2. **Task time estimation** — replaced with `lib/claude.ts` (keyword matching)
3. **Watch autofill from ref_no** — replaced with `app/api/ai/watch-autofill/route.ts` (static lookup table)

The `@anthropic-ai/sdk` package is still in `package.json` but nothing imports it. Safe to remove if desired.

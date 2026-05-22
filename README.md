# Watch QC Dashboard

An always-on office TV dashboard for a watch trading business. Displays live watch inventory and team task tracking via WhatsApp integration.

## Features

- **Watch Inventory** — grid of watch cards with pricing, mark-as-sold with one click
- **Team Task Tracking** — real-time task feed from WhatsApp replies, AI time estimates
- **Auto-scroll** — smooth continuous scrolling for unattended TV display
- **WhatsApp Automation** — daily morning message to all team members via GreenAPI
- **Task History** — searchable, filterable table of all past tasks
- **Real-time updates** — Server-Sent Events with 10s polling fallback

## Tech Stack

- **Next.js 14** (App Router, fullstack)
- **PostgreSQL** + Prisma ORM
- **GreenAPI** for WhatsApp
- **Claude API** (claude-sonnet-4-20250514) for AI time estimation
- **Tailwind CSS** dark theme
- Deployable on **Render**

---

## Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd qc-dashboard
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GREENAPI_INSTANCE_ID` | From app.green-api.com |
| `GREENAPI_API_TOKEN` | From app.green-api.com |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `NEXT_PUBLIC_BASE_URL` | Your app's public URL |

### 3. Database setup

```bash
# Run migrations
npm run db:migrate

# Or for development (push schema directly)
npm run db:push
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## GreenAPI Webhook Setup

1. Log in to [app.green-api.com](https://app.green-api.com)
2. Open your instance settings
3. Set webhook URL to: `https://your-app.onrender.com/api/webhook/greenapi`
4. Enable **"Incoming messages"** webhook type
5. Save

The webhook receives incoming WhatsApp messages and matches them to team members by phone number.

---

## Render Deployment

### Using render.yaml (recommended)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo — Render will read `render.yaml`
4. Set the environment variables in the Render dashboard:
   - `GREENAPI_INSTANCE_ID`
   - `GREENAPI_API_TOKEN`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_BASE_URL` (your Render app URL, e.g. `https://qc-dashboard.onrender.com`)
5. Deploy

### Manual setup

1. Create a PostgreSQL database on Render
2. Create a Web Service:
   - Build: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - Start: `npm start`
   - Add all env vars
3. After first deploy, set `NEXT_PUBLIC_BASE_URL` to your app's URL and redeploy

---

## Routes

| Route | Description |
|---|---|
| `/` | Main dashboard (watch inventory + team tasks) |
| `/history` | Task history with filters |
| `/settings` | GreenAPI config, team members |
| `POST /api/webhook/greenapi` | GreenAPI webhook receiver |
| `GET /api/sse` | Server-Sent Events stream |

---

## Cron Schedule

The server runs a cron job every minute that:
1. Reads the configured `auto_message_time` from the database
2. Checks if the current Pakistan Standard Time (UTC+5) matches
3. If yes, sends "Good morning! Please list your tasks for today." to all team members via WhatsApp

Default time: **8:00 AM PKT**. Change it in Settings.

---

## WhatsApp Number Format

Store numbers as: `923001234567` (country code + number, no spaces, no `+`)

GreenAPI format internally: `923001234567@c.us`

---

## Development Notes

- Tasks are dated using PKT (UTC+5) — today's tasks are those matching today's PKT date
- The SSE endpoint at `/api/sse` broadcasts real-time events to all connected dashboard clients
- AI estimation uses Claude to estimate task duration; falls back to 30 minutes on error
- `instrumentation.ts` starts the cron job when the Next.js server boots

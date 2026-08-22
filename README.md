# ReachInbox Scheduler

A production-grade email job scheduler + dashboard: schedule emails via API, deliver them
through **BullMQ delayed jobs** (no cron, anywhere), throttle and rate-limit sends safely
across multiple workers, and survive a full restart without losing or duplicating a single
email.

```
reachinbox-scheduler/
├── backend/     Express + TypeScript API, BullMQ worker, Prisma/Postgres
├── frontend/    Next.js 14 (App Router) + Tailwind dashboard
└── docker-compose.yml
```

---

## 1. Quick start

**Fastest path — one script, works with or without Docker:**

```bash
./setup.sh
```

This creates `backend/.env` and `frontend/.env.local` from their `.example` files (skips
if they already exist), then either brings up the full Docker stack (Postgres, Redis, API,
worker, frontend) if Docker is available, or installs dependencies for a manual local run
and prints the exact commands to start each process. Re-run it any time — it's idempotent.

A `Makefile` wraps the common commands afterward (`make up`, `make down`, `make logs`,
`make restart` to test persistence, `make migrate`, `make test`, etc.) — run `make help`
for the full list.

**Manual Docker path**, if you'd rather skip the script:

```bash
cp backend/.env.example backend/.env
# edit backend/.env: at minimum set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (see §3)
# and a real JWT_SECRET.

docker compose up --build
```

- API: http://localhost:4000
- Dashboard: http://localhost:3000
- Postgres: localhost:5432 (`reachinbox` / `reachinbox`)
- Redis: localhost:6379

The `api` container runs `prisma migrate deploy` on boot before starting the server, so a
fresh `docker compose up` produces a ready-to-use schema automatically.

## 2. Running locally without Docker

**Prerequisites:** Node 20+, a local Postgres instance, a local Redis instance.

```bash
# Backend
cd backend
cp .env.example .env        # point DATABASE_URL / REDIS_URL at your local instances
npm install
npm run prisma:migrate:dev  # creates the schema
npm run dev                 # API server on :4000

# In a second terminal — the worker is a separate process from the API on purpose,
# so it can be scaled independently in production:
cd backend
npm run worker:dev

# In a third terminal
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # dashboard on :3000
```

## 3. Google OAuth setup

Real Google OAuth is required (no mock login):

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create
   an **OAuth 2.0 Client ID** (type: Web application).
2. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
   (matches `GOOGLE_CALLBACK_URL` in `backend/.env`).
3. Copy the Client ID / Secret into `backend/.env` as `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.

Flow: the dashboard redirects the browser to `GET /api/auth/google` → Google's real consent
screen → Google redirects to our callback → the backend upserts a `User` row and issues a
**first-party JWT** → the browser is redirected to `/auth/callback?token=...` where the SPA
stores it and attaches it as `Authorization: Bearer <token>` on every API call.

## 4. Ethereal Email (fake SMTP) setup

Nothing to configure by hand: on boot, the API server calls `nodemailer.createTestAccount()`
via `senderProvisioning.ts` to provision `SENDER_COUNT` (default `2`) real Ethereal test SMTP
accounts and stores them as `Sender` rows. This is idempotent — restarting the server does not
create duplicate senders. Every sent email gets a real Ethereal preview URL, logged by the
worker (`previewUrl` in the worker logs) — open it to see the rendered email exactly as
"delivered."

To use fixed/pre-created Ethereal accounts instead, set `ETHEREAL_AUTO_CREATE=false` and seed
the `senders` table yourself (see `backend/src/utils/seedSenders.ts` as a template) with
credentials from https://ethereal.email.

### 4.1 Real delivery via Gmail SMTP (optional)

By default the app only ever delivers to Ethereal's fake inbox. To send real email instead,
set both `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `backend/.env` (a Google **App Password**,
not your normal Gmail password — requires 2-Step Verification enabled on the account, then
Google Account → Security → App passwords). On boot, `senderProvisioning.ts` detects these,
upserts a real Gmail `Sender` row, and **deactivates** (not deletes) any existing Ethereal
senders — so the round-robin in `schedulerService.ts` only ever picks active, real senders
once Gmail is configured, rather than mixing real and fake sends. Deactivated senders keep
their `Sender.isActive = false` flag rather than being removed, so past `Email` rows' sender
relation stays intact. Leave both env vars unset to keep using Ethereal.

---

## 5. Architecture

### 5.1 How scheduling works (no cron)

- `POST /api/campaigns` accepts a subject/body, a CSV/TXT lead file (parsed for email
  addresses via `parseLeads.ts`, deduped case-insensitively), a `startTime`, a
  `delayBetweenEmailsMs`, and a `hourlyLimitPerSender`.
- `schedulerService.ts` creates one `Campaign` row and one `Email` row per recipient,
  assigning senders round-robin and computing each recipient's `scheduledFor` as
  `startTime + index * delayBetweenEmailsMs` — so order is deterministic and preserved.
- Each `Email` is enqueued as a **BullMQ delayed job** (`emailQueue.ts`) with `delay =
  scheduledFor - now`. BullMQ stores delayed jobs in a Redis sorted set keyed by their
  ready-time; nothing polls a clock or evaluates a cron expression — Redis *is* the
  schedule, and the worker is woken by BullMQ exactly when a job becomes due.
- The job's `jobId` is set to the `Email.id` (deterministic). BullMQ treats `add()` with an
  existing `jobId` as a no-op, which is what makes re-enqueueing (see restart recovery
  below) safe to call unconditionally.

### 5.2 Restart / persistence behavior

Two independent layers protect against losing or duplicating scheduled sends:

1. **Redis AOF persistence** (`--appendonly yes` in `docker-compose.yml`) means BullMQ's
   delayed-job set survives a Redis container restart, not just a Node process restart.
   Stopping and starting the `api`/`worker` containers alone already "just works" — BullMQ
   reconnects and the same delayed jobs are still sitting in Redis waiting for their time.
2. **Database reconciliation sweep** (`reconciliation.ts`), run once at API boot and then
   every `RECONCILE_INTERVAL_MS` (default 60s): it scans for `Email` rows still in
   `PENDING`/`QUEUED` and checks whether a BullMQ job with that id exists; if not, it
   re-enqueues it. This is the safety net for the cases Redis persistence alone doesn't
   cover — e.g. the API process crashing between committing 1000 `Email` rows and finishing
   enqueueing all of their jobs, or a Redis volume being lost entirely while Postgres
   survives. Because `jobId` is deterministic, this sweep can run forever on a timer without
   ever creating a duplicate job.

**Idempotency against double-send:** before actually sending, the worker does a conditional
`UPDATE emails SET status = 'PROCESSING' WHERE id = ? AND status IN ('QUEUED','PENDING',
'RATE_LIMITED')`. If zero rows are affected (because another attempt already claimed and
sent it), the worker returns immediately without calling SMTP. This protects against BullMQ
retry races and the reconciliation sweep ever double-enqueuing.

### 5.3 Rate limiting & concurrency

| Requirement | Implementation |
|---|---|
| Configurable worker concurrency | `Worker(..., { concurrency: env.WORKER_CONCURRENCY })` in `emailWorker.ts` |
| Minimum delay between sends | BullMQ's built-in queue-wide limiter: `{ max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS }`. This throttles job **starts** across the whole worker (any number of concurrent workers/processes), giving an enforced floor on time between sends — not just a per-process `setTimeout`. |
| Emails/hour (configurable, per-sender) | `SenderHourlyRateLimiter` (`rateLimiter.ts`): a Redis key `ratelimit:sender:{id}:{hourBucket}`, incremented atomically with `INCR` and self-expiring via `EXPIRE` on first increment. Because the counter lives in Redis rather than in-process memory, it is correct even if you scale the worker to N replicas — there is exactly one shared count per sender per hour, not N independent ones. |
| Behavior at the hourly limit | The worker does **not** drop or fail the job. It marks the `Email` row `RATE_LIMITED` and re-enqueues it (`requeueForNextHourWindow`) as a new delayed job targeted at the start of the next UTC hour, preserving the original recipient/campaign/sender. |
| Behavior under 1000+ simultaneous schedules | `createCampaignAndSchedule` batch-inserts all `Email` rows (`createMany`) and then enqueues them individually with per-recipient staggered `scheduledFor` times (spaced by `delayBetweenEmailsMs`), so 1000 recipients scheduled "for now" don't all fire in the same instant — they fan out starting immediately and self-throttle via the limiter + hourly cap regardless. |

### 5.4 Frontend

- Next.js App Router, Tailwind, fully typed API client (`lib/api.ts`) using `fetch` +
  bearer token from `lib/auth.tsx` (a React context backed by `localStorage`).
- Rebuilt directly against the Outbox Labs Figma file — see §7 for design-fidelity notes.
- The dashboard polls `/api/emails/scheduled`, `/api/emails/sent`, and `/api/senders`
  every 4s so the sidebar counts and list views reflect worker activity close to real time.
- Reusable, typed components: `Sidebar`, `EmailListPane`, `ComposePane`,
  `RichTextEditor`, `SendLaterPopover`, `Button`/`StatusPill`, `EmptyState`/`LoadingState`.

---

## 6. Features implemented

**Backend**
- [x] Campaign scheduling API (`POST /api/campaigns`) with CSV/TXT lead upload
- [x] BullMQ delayed jobs, zero cron anywhere in the codebase
- [x] Restart persistence: Redis AOF + DB reconciliation sweep (§5.2)
- [x] Idempotency: deterministic `jobId` + conditional DB claim before send
- [x] Configurable worker concurrency
- [x] Configurable minimum delay between sends (queue-wide BullMQ limiter)
- [x] Configurable, Redis-backed, multi-worker-safe hourly rate limit per sender
- [x] Deferred (not dropped) jobs on hitting the hourly cap, re-queued to next hour
- [x] Real Google OAuth (Passport strategy → first-party JWT)
- [x] Auto-provisioned Ethereal SMTP senders (multi-sender support) + `GET /api/senders`
- [x] Optional real delivery via Gmail SMTP (§4.1) — the same round-robin/rate-limit/
      persistence path, just against real Google SMTP instead of Ethereal
- [x] Email attachments: images, video, and any other mail-supported file type, uploaded
      with the campaign, stored in Postgres (`Attachment` rows keyed to `Campaign`, since
      the api/worker run as separate containers with no shared filesystem), and attached
      to the real outgoing message via Nodemailer at send time — a denylist blocks
      directly-executable file types, everything else passes through
- [x] Structured logging (pino), centralized error handling, zod-validated env & input

**Frontend**
- [x] Real Google OAuth login → dashboard redirect
- [x] Sidebar with user profile, avatar, dropdown logout, and live Scheduled/Sent counts
      (matches the Figma "CORE" nav)
- [x] Scheduled Emails and Sent Emails list views with search bar, filter/refresh controls,
      and a Gmail-style body-text snippet next to the subject in each row
- [x] In-place Compose flow (replaces the main pane, matching the Figma IA rather than a
      modal): From (real sender list), To (typed chips + CSV/TXT list upload with
      overflow "+N" chip), Subject, Delay-between-sends / Hourly-limit fields, a rich-text
      body editor, file attachments (image/video thumbnail previews, chip fallback for
      other types, count badge on the paperclip icon), and a "Send / Send Later" popover
      with quick presets
- [x] Loading states and empty states on both list views
- [x] Login screen matching the Figma card (Google button, divider, email/password
      fields — see trade-offs below)

---

## 7. Frontend design fidelity

The frontend was rebuilt against the real Figma file (Outbox Labs Assignment) rather than
an original design: color tokens (white surface, green primary, peach "scheduled" /
gray "sent" status pills), the sidebar-driven information architecture (profile card,
Compose CTA, CORE nav with counts), the in-place Compose pane (not a modal), the chip-based
recipient list with CSV upload, and the "Send Later" popover with quick-pick presets are
all taken directly from the provided screens.

One intentional deviation, to avoid shipping non-functional UI in an otherwise
production-grade app:
- The Figma login card includes email/password fields. The assignment requires only real
  Google OAuth, so those fields are present for visual fidelity but submit to an inline
  notice ("continue with Google above") rather than a fake auth flow.

The compose header's attachment (paperclip) icon is fully wired up — it opens a real file
picker, previews images/video inline, and the files are actually attached to the outgoing
email (§6).

---

## 8. Assumptions, shortcuts & trade-offs

- **Auth storage:** the JWT is stored in `localStorage` and sent as a bearer header rather
  than an httpOnly cookie, to keep the cross-origin dev setup (`:3000` ↔ `:4000`) simple.
  A production hardening pass would move to httpOnly cookies with `SameSite`, short-lived
  access tokens, and a revocable refresh-token store (logout is currently a client-side
  token discard only).
- **Personalization:** the assignment's compose form takes one subject/body for the whole
  campaign; per-recipient merge fields (e.g. `{{company}}`) are not implemented — the body
  placeholder text hints at future support but recipients currently all receive identical
  content.
- **Pipeline counts** shown in the sidebar are the true total counts from the database
  (`total` from the paginated list endpoints), not a page-local approximation.
- **Sender assignment** is simple round-robin per campaign; there's no per-sender
  warm-up/reputation logic (out of scope for this assignment).
- **Real Gmail SMTP** (§4.1), when configured, is still subject to Google's own account-level
  sending limits (roughly 500/day on a regular Gmail account) — the app's own hourly-limit
  field is independent of that and doesn't know about it.
- **Attachments** are capped at 50MB per file / 10 files per campaign (matches the backend's
  multer limit) and shared by the whole campaign, not personalized per recipient. A small
  extension denylist blocks directly-executable file types (`.exe`, `.bat`, `.sh`, etc.,
  mirroring what most webmail providers block); everything else — images, video, PDFs,
  office docs, archives — is allowed through untouched.
- **Retries:** SMTP send failures get BullMQ's exponential backoff (4 attempts) before a
  row is marked `FAILED`; there's no dead-letter queue UI, just the `Sent Emails` tab
  showing `FAILED` rows with the last error message.

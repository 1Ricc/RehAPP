# RehAPP

A rehabilitation companion for physiotherapy patients — a daily checklist, a pain
diary and a progression engine that turns clinical adherence into visible
progress.

Built as a hackathon project (24-hour build) around a single clinical case: Marco,
34, twelve days after right-knee ACL reconstruction, on an 84-day four-phase
rehab plan.

---

## 1. Project Scope

### The problem

Post-operative rehabilitation fails on adherence, not on prescription. The plan
is correct; the patient stops doing it around week three, when the pain is gone
but the programme still has two months to run. There is no feedback loop between
"I did my exercises today" and anything the patient can see.

### What this project does

RehAPP closes that loop. The patient gets one screen per day with what has to be
done, a pain score to log, and a progression system that responds to both. The
core design decision is that **the reward system must never punish clinically
correct behaviour**:

- Reporting severe pain (VAS ≥ 7) pauses the day instead of breaking the streak.
- A prescribed rest day is a rest day — zero points, but the multiplier is frozen,
  not reset.
- Completing the checklist despite high pain is rewarded, not overridden by the
  pain rule.
- The notification engine is designed silence-first: the app says nothing on
  recovery days, nothing once the checklist is complete, and nothing at night.

### What is deliberately out of scope

This is a demo-grade MVP, and the boundaries are intentional rather than
unfinished:

| Out of scope | Why |
|---|---|
| Authentication | One hardcoded patient. The login screen is a button, not OAuth. |
| Multi-user / multi-tenancy | Single-row database by design (`CHECK (id = 1)`). |
| Physiotherapist-side app | The plan is seeded in code, not authored in-product. |
| Variable exercise frequency | Every exercise is daily so phase thresholds stay computable as `days × daily RP`. Weekly frequency requires rewriting the scoring engine, not the data. |
| Nutrition tracking | Present in the plan model as guidance text; never scored, never in the checklist. |
| Real partner integrations | The reward catalogue uses invented local partners — a pharmacy, a rehab pool, a sports shop. |

---

## 2. Features

### Daily workout & adherence

- **Three-block daily checklist** — exercises, medication doses, pain diary. Each
  block is all-or-nothing: partial completion is worth zero, so the unit of
  progress is a finished block, not a ticked box.
- **Phase-aware plan** — the exercise list, the medication schedule and the
  day's maximum value all change with the clinical phase. From phase 3 there is no
  prescribed drug, so a full day is worth 18 RP instead of 22.
- **VAS pain diary** — 0–10 slider with an optional note, submitted from a
  bottom-sheet modal.

### Progression engine

- **RP (rehab points)** — 16 for exercises, 4 for medication, 2 for the diary.
- **Streak multiplier** — `min(1 + 0.05 × (streak − 1), 5.0)`, carried across
  phases. Gems earned = `RP × multiplier`.
- **Gems** — the spendable currency, accumulated per day and on phase completion.
- **Four clinical phases** — Acute/Protective → Mobility Recovery →
  Strengthening → Functional/Return to Activity. A phase clears when
  `phaseRP ≥ threshold`; the level-up is user-confirmed, pays a flat 20% gem
  bonus, and carries RP overshoot forward.
- **Recovery days** — five-level precedence: prescribed rest and revaluation
  visits, then a complete checklist, then VAS ≥ 7 (unlimited), then one
  self-declared recovery per phase.
- **Pain alerts** — 3 consecutive high-VAS days suggests consulting the
  physiotherapist, 7 suggests reassessing the plan. Alerts never touch the streak.

### Rewards

- **Partner store** — six rewards from 60 to 1000 gems, each gated on a clinical
  phase so nobody is offered a gym voucher while still on crutches. One item is
  repeatable at a rising price (+50 per redemption) to act as a late-game gem sink.
- **Vouchers** — redeeming issues a voucher with a code, kept in a history list.
- **Badges** — First Week, Phase Cleared, Thirty Days, Faithful Diary. Always
  derived from history on read, never stored, so they cannot drift out of sync.
- **In-app benefits** — unlocked by clinical progress rather than by spending:
  the Pain Chart at phase 2, the Activity Calendar at phase 3.
- **Profile colour** — one accent per phase reached, the cheapest visible avatar
  progression.

### Visualisation & profile

- **Pain chart** — SVG line chart of the VAS trend over time, designed to be
  shown to a physiotherapist.
- **Activity heatmap** — a 365-day grid of completed / recovery / missed days.
- **Profile screen** — clinical information, goals, lifetime stats, badge
  progress, redeemed vouchers and saved plans.

### Create a Plan

A self-contained authoring tool, independent of the patient's own rehab plan:

- Compose a plan from a 15-exercise library across Shoulder / Knee / Ankle.
- Add medications with name, days and times.
- Save it and get a **6-character share code** generated server-side.
- Load someone else's plan by pasting the code or the full share URL.

### Notification engine (backend)

A pure engine exposed at `GET /api/notifications`, implemented but not yet wired
into the UI. It computes a reminder queue with a hard cap of three per day, plus
the explicit reason the app is currently silent. The quiet window is derived from
the medication times in the active plan rather than hardcoded. Copy is picked
deterministically from per-event variants, seeded on the notification id, so the
wording varies between days but never flickers between two polls of the same
event.

### Demo tooling

`/api/demo/*` routes load pre-built states (fresh start, one day from level-up,
41 days of history), advance the day with or without completion, and force
streak/gems/phase progress directly. `npm run demo:check` walks the whole demo
path and reports what broke.

---

## 3. Tech Stack & Architecture

### Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js ≥ 20, ES modules |
| Backend framework | Express 4 |
| Persistence | better-sqlite3 (synchronous SQLite, WAL mode) |
| Frontend | React 18 + TypeScript, Vite 6 |
| Styling | No UI library — inline styles against a hand-applied token set |
| Language | TypeScript 5.7 end to end |
| Tests | Vitest |
| Execution | `tsx` — TypeScript runs directly, no build step in development |

### Repository layout

```
team-11/
├── backend/                  Express + TypeScript API (port 3001)
│   ├── data/state.db         SQLite database (committed for demo reproducibility)
│   ├── src/
│   │   ├── api/              HTTP layer — routes, view models, errors, demo routes
│   │   ├── data/             persistence, seed plan, demo profiles, store catalogue
│   │   └── domain/           pure business logic + shared types
│   ├── scripts/giro-demo.ts  end-to-end demo walkthrough
│   └── tests/                scoring engine unit tests
├── frontend/                 React + Vite SPA (port 5173)
│   └── src/
│       ├── api.ts            typed fetch wrapper
│       ├── App.tsx           view-state router + single state atom
│       ├── views/            one file per screen
│       └── components/       BottomNav, VasModal, PainChart, Heatmap
└── ARCHITECTURE.md           detailed architecture reference
```

### Backend layering

```
HTTP request
     │
     ▼
 rotte.ts       routing + input validation
     │
     ▼
 servizio.ts    load / mutate / save — the only caller of the store
     │
     ▼
 domain/        pure functions: scoring, store, benefits, notifications
     │
     ▼
 store.ts       SQLite read/write
     │
     ▼
 state.db
```

The domain layer takes state and an instant and returns new state. No I/O, no
Express, no ambient clock — which is why the scoring engine is the part that is
unit-tested and the HTTP layer does not need to be.

### Architectural decisions

**Full-state responses.** Every mutating endpoint returns the complete
`RispostaStato`. The frontend never patches or diffs — it replaces its single
state atom and redraws. This removes an entire class of client/server divergence
bugs at the cost of slightly larger payloads, which is the correct trade at this
scale.

**One type file as the API contract.** The frontend imports domain types directly
from `backend/src/domain/types.ts` through a `tsconfig` path alias
(`@backend/* → ../backend/src/*`). Changing a response shape on the server
surfaces immediately as a TypeScript error in the client. There is no generated
client, no schema duplication, and no way for the two sides to disagree silently.

**Derive, don't store.** Badges, notifications, benefit gates and store
eligibility are computed on every read. Only the facts that cannot be recomputed —
the history, the wallet, the vouchers — are persisted.

**Single-row SQLite.** State is one JSON blob in a table constrained to one row,
with WAL mode and `synchronous = NORMAL`, an in-memory cache so the disk is read
once per process, and atomic upsert writes. A `VERSIONE_STATO` check wipes and
re-seeds when the persisted shape changes.

```sql
CREATE TABLE stato (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  versione INTEGER NOT NULL,
  dati     TEXT    NOT NULL   -- JSON blob
)
```

**Constants in one place.** Every tuned number — RP values, multiplier step and
cap, VAS threshold, day-close hour, alert thresholds — lives in
`domain/costanti.ts` and is read, never inlined. Changing the balance of the game
is a one-file edit.

**No router, no state library.** `App.tsx` holds a single
`useState<View>` over six views and a single `useState<RispostaStato>`. At six
screens, a router and a store would both be more code than the thing they
configure.

### Frontend shell

Mobile-first, a 430px column centred on a `#EDEFEA` background, with a fixed
frosted-glass bottom navigation. The outer shell is `height: 100vh; overflow:
hidden`; every view's scrollable region is `flex: 1; min-height: 0; overflow-y:
auto` so the container scrolls rather than the body — without `min-height: 0`
flex items refuse to shrink below content size and the fixed nav gets obscured.

### Conventions

The domain layer, its types and its identifiers are written in Italian
(`scoring`, `negozio`, `notifiche`, `gemme`, `fase`); all user-facing strings in
the UI are English. Comments explain *why* a decision was taken, not what the
line does.

---

## Running the project

Two terminals, no build step.

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev        # tsx watch, http://localhost:3001

# Terminal 2 — frontend
cd frontend
npm install
npm run dev        # Vite HMR, http://localhost:5173
```

Open `http://localhost:5173` and press the login button — no credentials.

The backend binds `0.0.0.0` and prints the LAN address at startup, so a phone on
the same WiFi can open the app at the printed IP (not `localhost`, which on a
phone is the phone).

### Commands

| Command | Location | Does |
|---|---|---|
| `npm run dev` | both | dev server with reload |
| `npm test` | backend | 53 scoring-engine tests |
| `npm run typecheck` | both | type check without emitting |
| `npm run demo:check` | backend | runs the full demo path and reports failures |
| `npm run build` | frontend | production bundle |

### Resetting state

State is a single SQLite file. Delete it and it regenerates on next boot:

```bash
rm backend/data/state.db
```

Or, without stopping the server:

```bash
curl -X POST localhost:3001/api/demo/reset
```

---

## API reference

Every mutating call returns the full state. Every error is a readable
`{ errore, messaggio }`, never a stack trace.

| Method | Path | Description |
|---|---|---|
| GET | `/api/state` | Full home state |
| POST | `/api/tasks/toggle` | Tick/untick one exercise or medication dose |
| POST | `/api/diary` | Submit VAS score + optional note |
| POST | `/api/day/recovery` | Declare a manual rest day |
| POST | `/api/phase/advance` | Confirm level-up after threshold reached |
| GET | `/api/history?giorni=N` | Past N days (max 400) for chart and heatmap |
| GET | `/api/badges` | Badge progress, always derived |
| GET | `/api/store` | Reward catalogue with eligibility pre-computed |
| POST | `/api/store/:id/redeem` | Purchase a reward; returns voucher + state |
| GET | `/api/vouchers` | Redeemed vouchers, newest first |
| GET | `/api/plans` | User-created plans, newest first |
| POST | `/api/plans` | Save a plan; `shareId` generated server-side |
| GET | `/api/plans/:shareId` | Look up a plan by 6-character share code |
| GET | `/api/notifications` | Notification queue + silence reason |
| GET | `/api/health` | `{ ok: true }` |

Full layer-by-layer detail, domain rules and design tokens are in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

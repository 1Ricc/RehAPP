# Rehub Architecture

Hackathon rehab-companion app. Built in 24 hours around one physiotherapy
patient and a hardcoded demo login; it now also carries real accounts —
username, scrypt-hashed password, one save file each — whenever a `DATABASE_URL`
is configured.

---

## Repository Layout

```
Rehub/
├── backend/               Express/TypeScript server (port 3001)
│   ├── data/
│   │   ├── state.db       SQLite database (committed)
│   │   └── .gitignore     ignores WAL sidecar files
│   ├── src/
│   │   ├── api/           HTTP layer (routes, view models, errors)
│   │   ├── data/          persistence + seed data
│   │   └── domain/        pure business logic + shared types
│   └── tests/             engine, store, password and plan-conversion tests
└── frontend/              React + Vite + TypeScript SPA (port 5173)
    └── src/
        ├── api.ts          typed fetch wrapper
        ├── App.tsx         view-state router
        ├── views/          one file per screen
        └── components/     shared UI components
```

---

## Backend

### Stack
- **Node.js** with `"type": "module"` (ES modules throughout)
- **Express 4** — routes, JSON body parsing, CORS open (demo phones on LAN)
- **better-sqlite3** — synchronous SQLite, single file `backend/data/state.db`, used
  for local work and the test suite
- **pg** — Postgres, used instead whenever `DATABASE_URL` is set (the deployment)
- **TypeScript** with `tsc` compilation

### Layer Diagram

```
HTTP Request
     │
     ▼
 rotte.ts          (routing + input validation)
     │
     ▼
 servizio.ts       (load / aggiorna / save — the only place that touches the store)
     │
     ▼
 domain/           (pure functions: scoring, negozio, benefit, notifiche)
     │
     ▼
 store.ts          (facade over the Deposito interface)
     │
     ▼
 deposito.ts       (picks a backend: Postgres if DATABASE_URL, else SQLite)
     │
     ├──▶ deposito-sqlite.ts   ──▶  state.db
     └──▶ deposito-postgres.ts ──▶  Postgres
```

### Files

| File | Role |
|---|---|
| `src/index.ts` | Express app setup, CORS, error middleware, server listen |
| `src/api/rotte.ts` | All API routes. Each uses the `rotta()` wrapper that catches async errors |
| `src/api/servizio.ts` | `statoCorrente()` and `aggiorna(fn)` — the only callers of `store.ts` |
| `src/api/vista.ts` | Assembles API response shapes (`componiStato`, `componiStorico`, etc.) |
| `src/api/errori.ts` | `ErroreApi`, `richiestaNonValida()`, `nonPossibile()` |
| `src/api/demo.ts` | `/api/demo/*` routes for advancing demo state (not for prod) |
| `src/api/auth.ts` | `/api/register`, `/api/login`, `/api/logout` |
| `src/api/sessione.ts` | Resolves the `X-Rehub-Session` header: guest id or login token |
| `src/data/store.ts` | Persistence facade: `load()`, `save()`, `reset()`, `apri()` |
| `src/data/deposito.ts` | The `Deposito` interface and the backend choice |
| `src/data/deposito-sqlite.ts` | SQLite implementation |
| `src/data/deposito-postgres.ts` | Postgres implementation, plus `pool()` |
| `src/data/utenti.ts` | Accounts and bearer tokens (`utenti`, `sessioni` tables) |
| `src/data/fixture.ts` | `datiIniziali()` (the demo, day 8 half done), `datiSenzaPiano()` (a new account), `datiPerSessione()` (which of the two) |
| `src/domain/password.ts` | scrypt hashing: `hashPassword()`, `verificaPassword()` |
| `src/domain/conversione-piano.ts` | `PianoCreato` → a scored `Piano` |
| `src/data/catalogo.ts` | Store rewards catalogue |
| `src/data/seed/piano-marco.ts` | The hardcoded rehab plan (4 phases, knee ACL) |
| `src/data/seed/profili.ts` | Demo profiles for `GET /api/demo/*` |
| `src/domain/types.ts` | **Single source of truth** for all types — imported by frontend too |
| `src/domain/costanti.ts` | All magic numbers in one place |
| `src/domain/scoring.ts` | Day classification, RP calculation, streak, multiplier, phase advance |
| `src/domain/benefit.ts` | In-app benefit unlock logic |
| `src/domain/negozio.ts` | Store/redeem logic |
| `src/domain/notifiche.ts` | Notification queue and silence rules |
| `src/domain/tempo.ts` | Date helpers (`giornataLogica`, `aggiungiGiorni`) |

### Persistence — two backends, one interface

`store.ts` is a facade. `deposito.ts` picks the implementation at first use:
Postgres when `DATABASE_URL` is set, SQLite otherwise. Both answer the same six
functions, so nothing above them knows which one replied.

**One row per save file**, keyed by session id — never one global row. Two
people on one public URL would otherwise overwrite each other.

```sql
-- SQLite (backend/data/state.db)
CREATE TABLE stato (
  id       TEXT    PRIMARY KEY,   -- session id, or `u-<uuid>` for an account
  versione INTEGER NOT NULL,
  dati     TEXT    NOT NULL,      -- JSON blob of DatiPersistiti
  visto_il INTEGER NOT NULL
);

-- Postgres, same shape; `dati` is JSONB so a state is readable from a console
CREATE TABLE stato (
  id       TEXT PRIMARY KEY,
  versione INTEGER NOT NULL,
  dati     JSONB   NOT NULL,
  visto_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- **In-memory cache** per process, keyed by id; `svuotaCache()` is the test seam
- **Version check**: if `versione !== VERSIONE_STATO` the row is wiped and re-seeded
- **Pruning**: guest rows are dropped after 48h and capped at 500, oldest first.
  Account rows (`u-%`) are never pruned — that is somebody's progress, not a demo

### Accounts (Postgres only)

```sql
CREATE TABLE utenti (
  id            TEXT PRIMARY KEY,          -- `u-<uuid>`, also the state row's id
  username      TEXT UNIQUE NOT NULL,      -- stored lowercase
  password_hash TEXT NOT NULL,             -- scrypt, `salt:hash` hex
  nome          TEXT NOT NULL,
  eta           INTEGER,
  obiettivo     TEXT NOT NULL DEFAULT '',
  creato_il     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessioni (
  token     TEXT PRIMARY KEY,              -- `t-<48 hex>`, opaque bearer token
  utente_id TEXT NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

State is keyed by **user id**, not by token: logging out throws the token away
and leaves the progress where it is. `sessione.ts` tells the two apart by the
`t-` prefix and resolves a token to its user on every request; an expired or
forged one falls back to a guest save file rather than a 401.

Without `DATABASE_URL` none of this exists: `registra()` throws and the route
answers 503, which leaves the anonymous demo exactly as it was.

### API Contract — Core Invariant

**Every mutating call returns the full `RispostaStato`**. The frontend never patches or diffs — it replaces its entire state atom and redraws.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/register` | Create an account; returns `{ token, utente, stato }` |
| POST | `/api/login` | Log in to an account, or fall through to the demo login |
| POST | `/api/logout` | Revoke the token in the session header |
| GET | `/api/state` | Full home state |
| POST | `/api/tasks/toggle` | Tick/untick one exercise or medication dose |
| POST | `/api/diary` | Submit VAS pain score + optional note |
| POST | `/api/day/recovery` | Declare a manual rest day |
| POST | `/api/phase/advance` | Confirm level-up after threshold is reached |
| GET | `/api/history?giorni=N` | Past N days (max 400) for chart/heatmap |
| GET | `/api/badges` | Badge progress, always derived (never stored) |
| GET | `/api/store` | Reward catalogue with buy-eligibility pre-computed |
| POST | `/api/store/:id/redeem` | Purchase a reward; returns voucher + full state |
| GET | `/api/vouchers` | Redeemed vouchers, newest first |
| GET | `/api/plans` | User-created plans, newest first |
| POST | `/api/plans` | Save a new plan; generates `shareId` server-side |
| GET | `/api/plans/:shareId` | Look up a plan by 6-char share code |
| POST | `/api/plans/:shareId/adopt` | Convert an authored plan and start being scored on it |
| GET | `/api/notifications` | Push notification queue + silence reason |
| GET | `/api/health` | `{ ok: true }` |

### Domain Rules (scoring.ts)

**Day classification — 5-level precedence, first match wins:**
1. Prescribed rest / revaluation date → `recupero`
2. Checklist fully complete → `normale` (even with VAS 8)
3. Diary VAS ≥ 7 → `recupero` (unlimited)
4. Manual recovery declared, budget not exhausted → `recupero` (1 per phase)
5. Otherwise → `normale` (streak breaks if incomplete)

Rule 2 above rule 3 is intentional: finishing with pain is rewarded, not penalised.

**RP per block (all-or-nothing):**
- Exercises: 16 RP
- Medications: 4 RP (phases 1–2 only)
- Diary: 2 RP

**Streak multiplier:** `min(1 + 0.05 × max(streak − 1, 0), 5.0)`
- Recovery days freeze the multiplier (not reset, not grown)
- Streak carries across phases

**Phase advance:**
- Triggered when `rpProgressoFase >= sogliaFaseAttuale`
- Pays flat phase-completion gem bonus (20% of threshold)
- RP overshoot carries into the new phase
- Manual recoveries budget (1/phase) resets; multiplier does not

**Pain alert scale (never touches streak):**
- 3+ consecutive high-VAS days → "consult physio"
- 7+ consecutive high-VAS days → "reassess plan"

---

## Frontend

### Stack
- **React 18** + **TypeScript** + **Vite**
- No UI library — all inline styles, design-system tokens applied by hand
- Mobile-first, 430 px shell centred on `#EDEFEA` background

### Design Tokens

| Token | Value |
|---|---|
| Background | `#EDEFEA` |
| Surface | `#FFFFFF`, border `1px solid #EEF0EA`, radius 24px |
| Dark card | `#2E3A2E` |
| Text primary | `#21281F` |
| Text secondary | `#8A9485`, `#6B7566` |
| Accent (blue) | `#4FA8E8` |
| Accent light | `#EAF4FC` |
| Gold (gems) | `#C9A227` |
| Green (success) | `#3BAB6E` |
| Fonts | Poppins (headings), Inter (body), JetBrains Mono (codes/times) |

### Shell Layout (App.tsx)

```
<div height:100vh display:flex justify-content:center background:#EDEFEA>
  <div width:430px height:100vh display:flex flex-direction:column overflow:hidden>
    {content()}          ← Fragment: sticky header + scrollable content div
    <BottomNav />        ← position:fixed bottom:0 left:50% translateX(-50%) z-index:100
  </div>
</div>
```

**Critical layout rule:** the outer shell is `height: 100vh; overflow: hidden` (not `min-height`). Every view's scrollable content div must have `flex: 1; min-height: 0; overflow-y: auto`. Without `min-height: 0`, flex items won't shrink below content size and the body scrolls instead of the container, causing the fixed BottomNav to be obscured.

### Routing

`App.tsx` holds a single `useState<View>` where `View = 'login' | 'register' | 'choose-plan' | 'main' | 'workout' | 'profile' | 'shop' | 'create'`. No router library. `content()` is a switch that returns the active view JSX.

Every state the app receives goes through `updateStato`, which sends a
`senzaPiano` state to `'choose-plan'` and nowhere else — the builder excepted,
since being bounced out of it mid-form would make a plan impossible to finish.

BottomNav is hidden on `'login'`, `'register'`, `'create'` and `'choose-plan'`
(focused flows), and while `senzaPiano` is true: Workout and Shop have nothing
to show without a plan.

### Views

| File | Route | Fetches |
|---|---|---|
| `LoginView.tsx` | `login` | `POST /api/login` — an account token, or the demo's bare state |
| `RegisterView.tsx` | `register` | `POST /api/register`; stores the token and lands on choose-plan |
| `ChoosePlanView.tsx` | `choose-plan` | `GET /api/plans` on mount; `POST /api/plans/:shareId/adopt` |
| `HomeView.tsx` | `main` | Uses `stato` prop from App |
| `WorkoutView.tsx` | `workout` | Uses `stato` prop; mutations call toggle/diary/recovery |
| `ProfileView.tsx` | `profile` | `GET /api/history`, `/badges`, `/vouchers`, `/plans` on mount |
| `ShopView.tsx` | `shop` | `GET /api/store` on mount and after every gem change |
| `CreatePlanView.tsx` | `create` | `GET /api/plans/:shareId` (lookup); `POST /api/plans` (generate) |

### Components

| File | Description |
|---|---|
| `BottomNav.tsx` | 5-tab fixed nav; `position:fixed; z-index:100` |
| `VasModal.tsx` | Bottom-sheet pain diary (0–10 slider); `z-index: 200/201` |
| `PainChart.tsx` | SVG line chart of VAS over time; gated on `benefit.sbloccato` |
| `Heatmap.tsx` | GitHub-style 365-day activity grid; gated on `benefit.sbloccato` |

### API Client (api.ts)

Thin typed wrappers around `fetch`. All calls proxy through Vite (`/api` → `http://localhost:3001`) so no CORS in development. Each function is typed against the response interfaces from `@backend/domain/types`.

### Shared Types

The frontend imports directly from `backend/src/domain/types.ts` via a `tsconfig` path alias:

```json
"paths": { "@backend/*": ["../backend/src/*"] }
```

This means the backend type file **is** the API contract. Any type change there immediately surfaces as a TS error in the frontend.

### State Management

- `App.tsx` owns `stato: RispostaStato | null` in a single `useState`
- Every mutation (`toggleTask`, `submitDiary`, etc.) receives the new full state in the response and calls `updateStato(s)` which replaces the atom
- No context, no store library — the state is passed as props to views
- The `ProfileView` fetches its own auxiliary data (history, badges, etc.) in a `useEffect` on mount

### In-App Benefit Gates

Two features are gated on clinical progress (phase reached), not on gem purchases:
- `grafico-dolore` (Pain Chart): unlocked at phase ≥ 2
- `calendario-heatmap` (Activity Heatmap): unlocked at phase ≥ 3

Check `benefit.sbloccato` from `RispostaStato.benefit[]`.

### Create a Plan

The Create a Plan screen is a self-contained tool that does not depend on the patient's rehabilitation plan. It:
- Lets a user compose a plan from an exercise library (15 exercises across Shoulder / Knee / Ankle)
- Adds medications with name, days, and times
- Saves to `POST /api/plans` → stored in `DatiPersistiti.pianiCreati[]`
- Generates a 6-char `shareId` (server-side) for sharing
- Can load someone else's plan via `GET /api/plans/:shareId` (bare code or full URL accepted)
- Generate button is permanently disabled after first successful save (green "✓ Plan Generated")
- Saved plans are visible on the Profile screen

---

## Development Setup

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev          # ts-node-esm watch, port 3001

# Terminal 2 — frontend
cd frontend
npm install
npm run dev          # Vite HMR, port 5173
```

Open `http://localhost:5173`. Click login (no credentials needed) → full app.

The backend also prints LAN IPs so a real phone on the same WiFi can connect.

---

## Key Invariants

1. The domain layer (`src/domain/`) is pure — no I/O, no Express, no clock. Testable without a server.
2. Every API mutation returns the full `RispostaStato`; the frontend never patches.
3. RP blocks are all-or-nothing: partial completion is worth zero.
4. Recovery days earn zero RP and zero gems, but the multiplier is frozen (not reset).
5. The streak multiplier carries across phases; manual recovery budget does not.
6. Pain alert counter only drives messages; it never touches the streak.
7. The `pianiCreati` field in `DatiPersistiti` is optional (`?`) for backward compatibility — always read with `?? []`.
8. The logical day closes at 02:00, not midnight (`ORA_CHIUSURA_GIORNATA = 2`).
9. Gems are stored with decimals internally and floored on the way out of the API.
10. `VERSIONE_STATO = 2` — bump this and add a migration path when `DatiPersistiti` shape changes.

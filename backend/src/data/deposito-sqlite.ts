/**
 * Persistence: SQLite, one row per session.
 *
 * The state is stored as a JSON blob keyed by session id. Normalising into
 * relational tables would mean teaching the ORM the whole domain model for
 * zero query benefit — nothing here filters or joins; it always loads the
 * whole state and replaces the whole state.
 *
 * Two properties the file-based version had to work hard for come for free:
 *  - atomic writes: SQLite transactions are atomic by definition
 *  - serialised writes: better-sqlite3 is synchronous, so two writes cannot
 *    interleave inside the same process
 *
 * WAL mode is on so readers do not block writers and vice-versa. NORMAL
 * synchronous survives an OS crash (the WAL is replayed) while being fast
 * enough that a restart is not a demo-day risk.
 *
 * **The session id is a save-file key, not authentication.** Anyone holding
 * another id gets that demo. That is the accepted trade: the alternative is
 * real accounts, and the point of this table is to stop two people on one
 * public URL from overwriting each other, not to keep secrets.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERSIONE_STATO } from '../domain/costanti.js';
import type { DatiPersistiti } from '../domain/types.js';
import { datiIniziali } from './fixture.js';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Deployed, the writable directory is wherever the host mounts it, which is
// never next to the source. Locally the default keeps `backend/data` working
// with no environment to set up.
const CARTELLA_DATI = process.env['REHUB_DATA_DIR'] ?? join(RADICE, 'data');
const DB_PATH = join(CARTELLA_DATI, 'state.db');

/**
 * Schema generation, tracked separately from `VERSIONE_STATO` (which versions
 * the *shape of the blob*, not the table around it).
 *
 * 1 = one row per session. Before it there was a single row pinned by
 * `CHECK (id = 1)`, and `CREATE TABLE IF NOT EXISTS` would silently keep that
 * old table — every insert with a real session id would then fail the check.
 * So the upgrade drops the table rather than trusting the create.
 */
const SCHEMA = 1;

/** Sessions untouched for this long are demos nobody came back to. */
const SCADENZA_MS = 48 * 60 * 60 * 1000;

/** Hard cap, so a shared link cannot grow the file without bound. */
const MAX_SESSIONI = 500;

let db: Database.Database | null = null;
const cache = new Map<string, DatiPersistiti>();

function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(CARTELLA_DATI, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  const generazione = Number(db.pragma('user_version', { simple: true }) ?? 0);
  if (generazione < SCHEMA) {
    // Nothing here is worth migrating: every row is a demo save file, and a
    // login re-seeds one from scratch in a second.
    db.exec('DROP TABLE IF EXISTS stato');
    if (generazione > 0 || esisteVecchiaTabella(db)) {
      console.warn('[store] schema aggiornato a una riga per sessione, riparto pulito');
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS stato (
      id       TEXT    PRIMARY KEY,
      versione INTEGER NOT NULL,
      dati     TEXT    NOT NULL,
      visto_il INTEGER NOT NULL
    )
  `);
  db.pragma(`user_version = ${SCHEMA}`);
  return db;
}

/** Only used to decide whether the drop above is worth a log line. */
function esisteVecchiaTabella(database: Database.Database): boolean {
  const row = database
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stato'")
    .get();
  return row !== undefined;
}

export function percorsoStato(): string {
  return DB_PATH;
}

/** What the boot log says this process is persisting to. */
export function descrizione(): string {
  return `SQLite ${DB_PATH}`;
}

/**
 * Opens the database and runs the schema upgrade up front, so the first request
 * of the day is not the one that pays for it — and so a broken data directory
 * fails at boot, where the log is being read, rather than mid-demo.
 *
 * Async only to match the interface: better-sqlite3 is synchronous, and the
 * Postgres backend behind the same seam is not.
 */
export async function apri(): Promise<void> {
  getDb();
}

/**
 * Loads one session's state, seeding a fresh one the first time that id is
 * seen. An unknown id is not an error: it is simply somebody who has just
 * opened the app.
 */
export async function load(sessione: string): Promise<DatiPersistiti> {
  const inMemoria = cache.get(sessione);
  if (inMemoria) return inMemoria;

  const database = getDb();
  const row = database
    .prepare<[string], { versione: number; dati: string }>(
      'SELECT versione, dati FROM stato WHERE id = ?',
    )
    .get(sessione);

  if (!row) return inizializza(database, sessione);

  if (row.versione !== VERSIONE_STATO) {
    // Shape changed under an existing row — clear it and start fresh.
    database.prepare('DELETE FROM stato WHERE id = ?').run(sessione);
    console.warn('[store] versione stato cambiata, riparto dal fixture');
    return inizializza(database, sessione);
  }

  const dati = JSON.parse(row.dati) as DatiPersistiti;
  cache.set(sessione, dati);
  return dati;
}

export async function save(sessione: string, dati: DatiPersistiti): Promise<DatiPersistiti> {
  cache.set(sessione, dati);
  upsert(getDb(), sessione, dati);
  return dati;
}

export async function reset(sessione: string, adesso: Date = new Date()): Promise<DatiPersistiti> {
  cache.delete(sessione);
  const database = getDb();
  database.prepare('DELETE FROM stato WHERE id = ?').run(sessione);
  return inizializza(database, sessione, adesso);
}

/** Test seam: drops the in-memory cache without touching the file. */
export function svuotaCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function upsert(database: Database.Database, sessione: string, dati: DatiPersistiti): void {
  database
    .prepare<[string, number, string, number]>(`
      INSERT INTO stato (id, versione, dati, visto_il) VALUES (?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        versione = excluded.versione,
        dati     = excluded.dati,
        visto_il = excluded.visto_il
    `)
    .run(sessione, dati.versione, JSON.stringify(dati), Date.now());
}

function inizializza(
  database: Database.Database,
  sessione: string,
  adesso: Date = new Date(),
): DatiPersistiti {
  // The table only grows when a new session appears, so this is the one place
  // that has to pay for the cleanup.
  potaSessioni(database);

  const dati = datiIniziali(adesso);
  cache.set(sessione, dati);
  upsert(database, sessione, dati);
  return dati;
}

/**
 * Drops what nobody is coming back for: anything stale, then anything past the
 * cap, oldest first. Rows are a few kB, so this is insurance against a link
 * being passed around, not an optimisation.
 */
function potaSessioni(database: Database.Database): void {
  database.prepare('DELETE FROM stato WHERE visto_il < ?').run(Date.now() - SCADENZA_MS);
  database
    .prepare(`
      DELETE FROM stato WHERE id NOT IN (
        SELECT id FROM stato ORDER BY visto_il DESC LIMIT ?
      )
    `)
    .run(MAX_SESSIONI);
  // The cache can outlive the rows it mirrors; it is only a cache, and the
  // next load rebuilds whatever is still there.
  if (cache.size > MAX_SESSIONI) cache.clear();
}

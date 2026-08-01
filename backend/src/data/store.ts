/**
 * Persistence: SQLite, one table, one row, one user.
 *
 * The state is stored as a JSON blob in a single row. Normalising into
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
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERSIONE_STATO } from '../domain/costanti.js';
import type { DatiPersistiti } from '../domain/types.js';
import { datiIniziali } from './fixture.js';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARTELLA_DATI = join(RADICE, 'data');
const DB_PATH = join(CARTELLA_DATI, 'state.db');
const JSON_PATH = join(CARTELLA_DATI, 'state.json');

let db: Database.Database | null = null;
let cache: DatiPersistiti | null = null;

function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(CARTELLA_DATI, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS stato (
      id      INTEGER PRIMARY KEY CHECK (id = 1),
      versione INTEGER NOT NULL,
      dati    TEXT    NOT NULL
    )
  `);
  return db;
}

export function percorsoStato(): string {
  return DB_PATH;
}

/**
 * Loads the state. On the first call after install the table is empty, so we
 * try to migrate from state.json before falling back to a fresh fixture.
 */
export async function load(): Promise<DatiPersistiti> {
  if (cache) return cache;

  const database = getDb();
  const row = database
    .prepare<[], { versione: number; dati: string }>('SELECT versione, dati FROM stato WHERE id = 1')
    .get();

  if (!row) return inizializza(database);

  if (row.versione !== VERSIONE_STATO) {
    // Shape changed under an existing DB — clear the row and start fresh.
    database.prepare('DELETE FROM stato WHERE id = 1').run();
    console.warn('[store] versione stato cambiata, riparto dal fixture');
    return inizializza(database);
  }

  cache = JSON.parse(row.dati) as DatiPersistiti;
  return cache;
}

export async function save(dati: DatiPersistiti): Promise<DatiPersistiti> {
  cache = dati;
  upsert(getDb(), dati);
  return dati;
}

export async function reset(adesso: Date = new Date()): Promise<DatiPersistiti> {
  cache = null;
  const database = getDb();
  database.prepare('DELETE FROM stato WHERE id = 1').run();
  return inizializza(database, adesso);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function upsert(database: Database.Database, dati: DatiPersistiti): void {
  database
    .prepare<[number, string]>(`
      INSERT INTO stato (id, versione, dati) VALUES (1, ?, ?)
      ON CONFLICT (id) DO UPDATE SET versione = excluded.versione, dati = excluded.dati
    `)
    .run(dati.versione, JSON.stringify(dati));
}

/**
 * Seeds from the fixture, but first tries to migrate a state.json left over
 * from the file-based version — that way the demo history survives the upgrade.
 */
function inizializza(database: Database.Database, adesso: Date = new Date()): DatiPersistiti {
  const migrated = tentaMigrazioneJson(database);
  if (migrated) return migrated;

  const dati = datiIniziali(adesso);
  cache = dati;
  upsert(database, dati);
  return dati;
}

function tentaMigrazioneJson(database: Database.Database): DatiPersistiti | null {
  if (!existsSync(JSON_PATH)) return null;
  try {
    const raw = readFileSync(JSON_PATH, 'utf8');
    const dati = JSON.parse(raw) as DatiPersistiti;
    if (dati.versione !== VERSIONE_STATO) return null;
    upsert(database, dati);
    renameSync(JSON_PATH, `${JSON_PATH}.migrated.bak`);
    console.log('[store] state.json migrato in state.db');
    cache = dati;
    return dati;
  } catch {
    return null;
  }
}

/**
 * Postgres store, one row per session or account.
 *
 * Same contract as the SQLite one: load the whole blob, replace the whole blob.
 * `dati` is JSONB rather than TEXT because the hosted database gives it to us
 * for free and it makes a state readable from a console when something goes
 * wrong on stage.
 *
 * This is the deployed backend. It exists because SQLite lives on a disk the
 * host is free to throw away between restarts, and an account whose progress
 * disappears on redeploy is worse than no account at all.
 */

import { Pool } from 'pg';

import { VERSIONE_STATO } from '../domain/costanti.js';
import type { DatiPersistiti } from '../domain/types.js';
import { datiIniziali } from './fixture.js';

/** Guest rows untouched for this long are demos nobody came back to. */
const SCADENZA_ORE = 48;

/** Hard cap on guest rows, so a shared link cannot grow the table without bound. */
const MAX_SESSIONI = 500;

let piscina: Pool | null = null;
const cache = new Map<string, DatiPersistiti>();

/**
 * Managed Postgres (Neon, Render, Supabase) terminates TLS at a proxy whose
 * chain Node does not ship, so verification is relaxed — this database holds
 * demo state and hashed passwords, never anything a MITM would want. A local
 * container has no TLS at all, hence the plain-connection case.
 */
function opzioniSsl(connectionString: string): false | { rejectUnauthorized: boolean } {
  const locale = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  if (locale || connectionString.includes('sslmode=disable')) return false;
  return { rejectUnauthorized: false };
}

export function pool(): Pool {
  if (piscina) return piscina;
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL non impostata');
  piscina = new Pool({ connectionString, ssl: opzioniSsl(connectionString), max: 5 });
  return piscina;
}

export async function apri(): Promise<void> {
  await pool().query(`
    CREATE TABLE IF NOT EXISTS stato (
      id       TEXT PRIMARY KEY,
      versione INTEGER NOT NULL,
      dati     JSONB   NOT NULL,
      visto_il TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export function descrizione(): string {
  return 'Postgres (DATABASE_URL)';
}

export async function load(id: string): Promise<DatiPersistiti> {
  const inMemoria = cache.get(id);
  if (inMemoria) return inMemoria;

  const { rows } = await pool().query<{ versione: number; dati: DatiPersistiti }>(
    'SELECT versione, dati FROM stato WHERE id = $1',
    [id],
  );
  const row = rows[0];
  if (!row) return inizializza(id);
  if (row.versione !== VERSIONE_STATO) {
    // Shape changed under an existing row — clear it and start fresh.
    await pool().query('DELETE FROM stato WHERE id = $1', [id]);
    return inizializza(id);
  }

  cache.set(id, row.dati);
  return row.dati;
}

export async function save(id: string, dati: DatiPersistiti): Promise<DatiPersistiti> {
  cache.set(id, dati);
  await pool().query(
    `INSERT INTO stato (id, versione, dati, visto_il) VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET versione = EXCLUDED.versione,
                                    dati     = EXCLUDED.dati,
                                    visto_il = now()`,
    [id, dati.versione, JSON.stringify(dati)],
  );
  return dati;
}

export async function reset(id: string, adesso: Date = new Date()): Promise<DatiPersistiti> {
  cache.delete(id);
  await pool().query('DELETE FROM stato WHERE id = $1', [id]);
  return inizializza(id, adesso);
}

export function svuotaCache(): void {
  cache.clear();
}

async function inizializza(id: string, adesso: Date = new Date()): Promise<DatiPersistiti> {
  // The table only grows when a new id appears, so this is the one place that
  // has to pay for the cleanup.
  await pota();
  const dati = datiIniziali(adesso);
  await save(id, dati);
  return dati;
}

/**
 * Anonymous rows only. An account's state is not garbage: it belongs to
 * somebody who can log back in, and deleting it would be deleting their
 * progress. Account ids are UUIDs prefixed `u-`; everything else is a guest.
 */
async function pota(): Promise<void> {
  await pool().query(
    `DELETE FROM stato
     WHERE id NOT LIKE 'u-%'
       AND visto_il < now() - ($1 || ' hours')::interval`,
    [String(SCADENZA_ORE)],
  );
  await pool().query(
    `DELETE FROM stato WHERE id NOT LIKE 'u-%' AND id NOT IN (
       SELECT id FROM stato WHERE id NOT LIKE 'u-%' ORDER BY visto_il DESC LIMIT $1
     )`,
    [MAX_SESSIONI],
  );
  // The cache can outlive the rows it mirrors; it is only a cache, and the next
  // load rebuilds whatever is still there.
  if (cache.size > MAX_SESSIONI) cache.clear();
}

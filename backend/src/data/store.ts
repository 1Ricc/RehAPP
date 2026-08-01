/**
 * Persistence: one JSON file, one user. SQLite would be a dependency to manage
 * a single row.
 *
 * Two guarantees, and nothing more:
 *  - atomic writes: temp file in the same directory, fsync, rename. A crash
 *    mid-write leaves the previous state intact, never a truncated file
 *  - serialized writes: concurrent save() calls queue up, so two requests
 *    ticking two items cannot interleave into a lost update
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';

import { VERSIONE_STATO } from '../domain/costanti.js';
import type { DatiPersistiti } from '../domain/types.js';
import { datiIniziali } from './fixture.js';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARTELLA_DATI = join(RADICE, 'data');
const FILE_STATO = join(CARTELLA_DATI, 'state.json');

/** Everything goes through here, so the file is read from disk once. */
let cache: DatiPersistiti | null = null;

/** Tail of the write queue. Every save() appends to it. */
let coda: Promise<void> = Promise.resolve();

export function percorsoStato(): string {
  return FILE_STATO;
}

/**
 * Current state. On first run — or after the file is deleted, which is how the
 * demo gets reset — it seeds from the fixture and writes it out.
 */
export async function load(): Promise<DatiPersistiti> {
  if (cache) return cache;

  const grezzo = await leggiFile();
  if (grezzo === null) {
    return inizializza();
  }

  let dati: DatiPersistiti;
  try {
    dati = JSON.parse(grezzo) as DatiPersistiti;
  } catch {
    // A corrupted file must not take the server down 10 minutes before the demo.
    await archivia('corrotto');
    return inizializza();
  }

  if (dati.versione !== VERSIONE_STATO) {
    // The shape changed under an old file. Keep the old one aside and start over.
    await archivia(`v${dati.versione}`);
    return inizializza();
  }

  cache = dati;
  return dati;
}

/** Writes the whole state and updates the cache. Callers pass the full object. */
export async function save(dati: DatiPersistiti): Promise<DatiPersistiti> {
  cache = dati;
  coda = coda
    .then(() => scriviAtomico(dati))
    .catch((errore) => {
      // Swallowing this silently is the worst case on demo day: the cache is
      // already updated, so the API keeps answering correctly while nothing
      // reaches the disk, and a restart loses everything. The queue still has to
      // survive the failure, hence the catch stays — it just stops being mute.
      console.error('[store] scrittura di state.json fallita:', errore);
    });
  await coda;
  return dati;
}

/** Drops the file and the cache, then reseeds. Used by /api/demo/reset later on. */
export async function reset(adesso: Date = new Date()): Promise<DatiPersistiti> {
  cache = null;
  return inizializza(adesso);
}

async function inizializza(adesso: Date = new Date()): Promise<DatiPersistiti> {
  const dati = datiIniziali(adesso);
  cache = dati;
  await save(dati);
  return dati;
}

async function leggiFile(): Promise<string | null> {
  try {
    return await readFile(FILE_STATO, 'utf8');
  } catch (errore) {
    if (codice(errore) === 'ENOENT') return null;
    throw errore;
  }
}

/** Moves a file we refuse to read out of the way instead of deleting it. */
async function archivia(motivo: string): Promise<void> {
  const destinazione = `${FILE_STATO}.${motivo}.bak`;
  try {
    await rename(FILE_STATO, destinazione);
    console.warn(`[store] state.json ${motivo}: spostato in ${destinazione}, riparto dal fixture`);
  } catch {
    console.warn(`[store] state.json ${motivo}: non archiviabile, riparto dal fixture`);
  }
}

/**
 * Temp file, fsync, rename. The rename is atomic on the same filesystem, so a
 * reader never sees a half-written file.
 */
async function scriviAtomico(dati: DatiPersistiti): Promise<void> {
  await mkdir(CARTELLA_DATI, { recursive: true });
  const temporaneo = `${FILE_STATO}.${process.pid}.tmp`;
  await writeFile(temporaneo, JSON.stringify(dati, null, 2), 'utf8');

  // Without the fsync the rename can land before the bytes do.
  const handle = await open(temporaneo, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }

  await rename(temporaneo, FILE_STATO);
}

function codice(errore: unknown): string | undefined {
  return typeof errore === 'object' && errore !== null && 'code' in errore
    ? String((errore as { code: unknown }).code)
    : undefined;
}

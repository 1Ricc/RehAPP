/**
 * The store's public face. Kept so every existing importer (servizio, rotte,
 * demo, index) is untouched by the backend split: they ask for a session's
 * state, and which database answers is decided in `deposito.ts`.
 */

import { deposito } from './deposito.js';
import type { DatiPersistiti } from '../domain/types.js';

export async function apri(): Promise<void> {
  return (await deposito()).apri();
}

export async function load(id: string): Promise<DatiPersistiti> {
  return (await deposito()).load(id);
}

export async function save(id: string, dati: DatiPersistiti): Promise<DatiPersistiti> {
  return (await deposito()).save(id, dati);
}

export async function reset(id: string, adesso?: Date): Promise<DatiPersistiti> {
  return (await deposito()).reset(id, adesso);
}

/** Test seam: drops the in-memory cache without touching the storage. */
export async function svuotaCache(): Promise<void> {
  (await deposito()).svuotaCache();
}

/** One line for the boot log: which store, and where. */
export async function descrizioneStato(): Promise<string> {
  return (await deposito()).descrizione();
}

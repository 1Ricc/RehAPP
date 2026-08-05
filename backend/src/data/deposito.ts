/**
 * Which store the process is talking to.
 *
 * Postgres when DATABASE_URL is set — that is the deployed configuration, where
 * accounts have to survive a restart. SQLite otherwise, which keeps local work
 * and the test suite offline and fast.
 *
 * The import is dynamic so the unused backend is never loaded: a laptop with no
 * database never touches `pg`, and a deployment never opens a SQLite file it
 * would then have to find a writable directory for.
 */

import type { DatiPersistiti } from '../domain/types.js';

export interface Deposito {
  apri(): Promise<void>;
  load(id: string): Promise<DatiPersistiti>;
  save(id: string, dati: DatiPersistiti): Promise<DatiPersistiti>;
  reset(id: string, adesso?: Date): Promise<DatiPersistiti>;
  svuotaCache(): void;
  descrizione(): string;
}

let scelto: Deposito | null = null;

/**
 * Both modules export exactly the six functions of `Deposito`, so their
 * namespace object *is* a Deposito — TypeScript just will not say so about a
 * dynamic import, hence the cast.
 */
export async function deposito(): Promise<Deposito> {
  if (scelto) return scelto;
  scelto = process.env['DATABASE_URL']
    ? ((await import('./deposito-postgres.js')) as unknown as Deposito)
    : ((await import('./deposito-sqlite.js')) as unknown as Deposito);
  return scelto;
}

/** Test seam: forget the choice so a test can switch backends. */
export function dimenticaDeposito(): void {
  scelto = null;
}

/**
 * Local dates. Everything runs in the machine's timezone: one user, one laptop,
 * a phone on the same wifi.
 */

import { ORA_CHIUSURA_GIORNATA } from './costanti.js';
import type { DataISO } from './types.js';

/** `YYYY-MM-DD` from the local calendar fields, not from UTC. */
export function dataLocale(d: Date): DataISO {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

/**
 * The logical day an instant belongs to. Anything before 02:00 belongs to the
 * day before: whoever trains late at night is not punished by the clock.
 */
export function giornataLogica(adesso: Date = new Date()): DataISO {
  const d = new Date(adesso);
  if (d.getHours() < ORA_CHIUSURA_GIORNATA) {
    d.setDate(d.getDate() - 1);
  }
  return dataLocale(d);
}

export function aggiungiGiorni(data: DataISO, giorni: number): DataISO {
  const [anno, mese, giorno] = data.split('-').map(Number) as [number, number, number];
  const d = new Date(anno, mese - 1, giorno);
  d.setDate(d.getDate() + giorni);
  return dataLocale(d);
}

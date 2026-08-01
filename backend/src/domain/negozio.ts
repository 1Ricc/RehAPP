/**
 * Store and vouchers (TODO-backend.md §6).
 *
 * The catalogue is computed against the state, so the frontend never decides
 * whether something is buyable: it reads `acquistabile` and enables the button.
 * Gems are compared **floored**, the same value shown in the top bar — comparing
 * against 199.6 while the screen says 200 is exactly how a demo dies.
 */

import { CATALOGO, vocePerId, type VoceCatalogo } from '../data/catalogo.js';
import type { DatiPersistiti, Ricompensa, Voucher } from './types.js';

/** The repeatable item costs more every time: 150, 200, 250, … */
export function costoAttuale(voce: VoceCatalogo, volteRiscattata: number): number {
  return voce.costo + (voce.incrementoPerRiscatto ?? 0) * volteRiscattata;
}

function volte(dati: DatiPersistiti, id: string): number {
  return dati.voucher.filter((v) => v.ricompensaId === id).length;
}

export function componiRicompensa(dati: DatiPersistiti, voce: VoceCatalogo): Ricompensa {
  const volteRiscattata = volte(dati, voce.id);
  const costo = costoAttuale(voce, volteRiscattata);
  const gemme = Math.floor(dati.stato.gemmePortafoglio);
  const sbloccato = dati.stato.faseRaggiunta >= voce.faseRichiesta;
  const ripetibile = voce.incrementoPerRiscatto !== undefined;

  return {
    id: voce.id,
    nome: voce.nome,
    partner: voce.partner,
    descrizione: voce.descrizione,
    costo,
    costoBase: voce.costo,
    faseRichiesta: voce.faseRichiesta,
    sbloccato,
    // A one-shot reward already taken is no longer buyable.
    acquistabile: sbloccato && gemme >= costo && (ripetibile || volteRiscattata === 0),
    ripetibile,
    volteRiscattata,
    gemmeMancanti: Math.max(costo - gemme, 0),
  };
}

export function catalogo(dati: DatiPersistiti): Ricompensa[] {
  return CATALOGO.map((voce) => componiRicompensa(dati, voce));
}

/**
 * The nearest reward still out of reach — the "177/200" on the home. Skips what
 * the phase has not unlocked yet: dangling a locked item is not a teaser, it is
 * a tease.
 */
export function prossimaRicompensa(elenco: Ricompensa[]): Ricompensa | null {
  const candidate = elenco.filter((r) => r.sbloccato && !r.acquistabile && r.gemmeMancanti > 0);
  if (candidate.length === 0) return null;
  return candidate.reduce((vicina, r) => (r.gemmeMancanti < vicina.gemmeMancanti ? r : vicina));
}

/** `REHUB-7K2M-9XQ4`. Mock: nothing is sent anywhere, nothing is validated. */
export function generaCodice(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1: unreadable aloud
  const gruppo = () =>
    Array.from(
      { length: 4 },
      () => alfabeto[Math.floor(Math.random() * alfabeto.length)] as string,
    ).join('');
  return `REHUB-${gruppo()}-${gruppo()}`;
}

export class ErroreNegozio extends Error {}

/**
 * Spends the gems and issues the voucher. Throws `ErroreNegozio` when the buy
 * is not allowed, so the route can turn it into a readable message.
 */
export function riscatta(dati: DatiPersistiti, id: string, adesso: Date = new Date()): DatiPersistiti {
  const voce = vocePerId(id);
  if (!voce) throw new ErroreNegozio(`La ricompensa "${id}" non esiste.`);

  const ricompensa = componiRicompensa(dati, voce);
  if (!ricompensa.sbloccato) {
    throw new ErroreNegozio(
      `"${voce.nome} — ${voce.partner}" si sblocca in fase ${voce.faseRichiesta}. Ci sei quasi.`,
    );
  }
  if (!ricompensa.ripetibile && ricompensa.volteRiscattata > 0) {
    throw new ErroreNegozio(`Hai già riscattato "${voce.nome} — ${voce.partner}".`);
  }
  if (!ricompensa.acquistabile) {
    throw new ErroreNegozio(
      `Ti mancano ${ricompensa.gemmeMancanti} gemme per "${voce.nome} — ${voce.partner}".`,
    );
  }

  const voucher: Voucher = {
    id: `vch-${dati.voucher.length + 1}-${voce.id}`,
    ricompensaId: voce.id,
    nome: voce.nome,
    partner: voce.partner,
    codice: generaCodice(),
    gemmeSpese: ricompensa.costo,
    riscattatoIl: adesso.toISOString(),
  };

  return {
    ...dati,
    stato: { ...dati.stato, gemmePortafoglio: dati.stato.gemmePortafoglio - ricompensa.costo },
    voucher: [...dati.voucher, voucher],
  };
}

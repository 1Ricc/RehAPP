/**
 * Initial persisted state, so the frontend has something to render.
 *
 * The plan comes from seed/piano-marco.ts. The user state reproduces day 7 of
 * README §5.5 verbatim — 154 RP, 177.1 gems, streak 7, x1.30 — so anyone
 * comparing the screen to the document sees the same numbers.
 *
 * The demo profiles of block 9 (`nuovo`, `avanzato`, `soglia`) replace this
 * function; the plan they anchor is the same one.
 */

import { VERSIONE_STATO } from '../domain/costanti.js';
import { aggiungiGiorni, giornataLogica } from '../domain/tempo.js';
import type { DatiPersistiti, StatoUtente } from '../domain/types.js';
import { creaPianoMarco } from './seed/piano-marco.js';

/** Days already closed when the demo starts: the seven of the README table. */
const GIORNI_GIA_FATTI = 7;

const STATO: StatoUtente = {
  faseRaggiunta: 1,
  // Overwritten with the phase's real threshold in datiIniziali().
  sogliaFaseAttuale: 308,
  rpProgressoFase: 154,
  rpTotali: 154,
  giorniFaseTrascorsi: 7,
  gemmePortafoglio: 177.1,
  streakGiorni: 7,
  moltiplicatoreAttuale: 1.3,
  recuperiManualiUsatiInFase: 0,
  giorniVasAltiConsecutivi: 0,
  avanzamentoDisponibile: false,
  ultimaGiornataChiusa: null,
};

/**
 * A fresh persisted blob. Day 8 is open and half done on purpose: the checklist
 * shows both ticked and unticked items without anyone having to click first.
 */
export function datiIniziali(adesso: Date = new Date()): DatiPersistiti {
  const oggi = giornataLogica(adesso);
  // The plan starts seven days back, so today is day 8 and the first prescribed
  // rest day (offset 10) is two days ahead — close enough to show in a demo.
  const piano = creaPianoMarco(aggiungiGiorni(oggi, -GIORNI_GIA_FATTI));
  const fase1 = piano.fasi[0];
  if (!fase1) throw new Error('piano senza fasi');

  return {
    versione: VERSIONE_STATO,
    piano,
    stato: {
      ...STATO,
      sogliaFaseAttuale: fase1.sogliaRp,
      ultimaGiornataChiusa: aggiungiGiorni(oggi, -1),
    },
    giornoCorrente: {
      data: oggi,
      eserciziFatti: ['es-1-sollevamento'],
      dosiPrese: ['far-ibuprofene@08:00'],
      diario: null,
      recuperoManuale: null,
    },
    storico: [],
    voucher: [],
    pianiCreati: [],
  };
}

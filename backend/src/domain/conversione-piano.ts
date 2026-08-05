/**
 * Turns a plan somebody authored into a plan the engine can score.
 *
 * The two are not the same object. A PianoCreato says "these exercises, on
 * these weekdays, for this many weeks". A Piano says "these phases, each worth
 * this many RP, with these dates off". The gap between them is this file.
 *
 * Per-exercise `frequenza` is dropped on purpose. The threshold of a phase is
 * its working days x the daily total, which only holds if every working day is
 * worth the same — see the note at the top of seed/piano-marco.ts. Honouring a
 * per-exercise frequency means summing over the calendar, which is an engine
 * change, not a data change.
 */

import { BONUS_FINE_FASE, RP_DIARIO, RP_ESERCIZI, RP_FARMACI } from './costanti.js';
import { aggiungiGiorni } from './tempo.js';
import type { DataISO, Esercizio, Farmaco, Fase, Paziente, Piano, PianoCreato } from './types.js';

export class PianoNonConvertibile extends Error {}

/** Four, so the phase-gated benefits and store items still unlock on the way. */
const NUMERO_FASI = 4;

/** Indexed by `Date.getDay()`, which counts from Sunday. */
const GIORNI_SETTIMANA = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const NOMI_FASI = [
  'Early Phase',
  'Progression Phase',
  'Strengthening Phase',
  'Return to Activity',
] as const;

export function convertiPiano(
  creato: PianoCreato,
  paziente: Paziente,
  dataInizio: DataISO,
): Piano {
  if (creato.esercizi.length === 0) {
    throw new PianoNonConvertibile('Un piano senza esercizi non è allenabile.');
  }
  // The UI sends 'Mon'…'Sun'; this also accepts 'monday' and 'mon'.
  const selezionati = new Set(creato.giorni.map((g) => g.toLowerCase().slice(0, 3)));
  if (selezionati.size === 0) {
    throw new PianoNonConvertibile('Serve almeno un giorno della settimana.');
  }

  const esercizi: Esercizio[] = creato.esercizi.map((e) => ({
    id: e.id,
    nome: e.nome,
    serie: e.serie,
    ripetizioni: e.ripetizioni,
    frequenzaSettimanale: 7,
    ...(e.area ? { note: e.area } : {}),
  }));

  const farmaci: Farmaco[] = creato.farmaci.map((f, i) => ({
    id: `far-${i}-${f.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    nome: f.nome,
    orario: f.orari,
  }));

  const giornalieri = RP_ESERCIZI + (farmaci.length > 0 ? RP_FARMACI : 0) + RP_DIARIO;

  // Walk the whole calendar once: every date is either a working day or a
  // prescribed rest day, and the phases are cut from the working days in order.
  const totaleGiorni = creato.settimane * 7;
  const lavorativi: DataISO[] = [];
  const riposo: DataISO[] = [];
  for (let i = 0; i < totaleGiorni; i += 1) {
    const data = aggiungiGiorni(dataInizio, i);
    // Midday, so a DST shift cannot move the date across midnight.
    const giorno = GIORNI_SETTIMANA[new Date(`${data}T12:00:00`).getDay()];
    if (giorno && selezionati.has(giorno)) lavorativi.push(data);
    else riposo.push(data);
  }

  if (lavorativi.length < NUMERO_FASI) {
    throw new PianoNonConvertibile(
      `Servono almeno ${NUMERO_FASI} giorni di allenamento: questo piano ne ha ${lavorativi.length}.`,
    );
  }

  const perFase = Math.floor(lavorativi.length / NUMERO_FASI);
  const fasi: Fase[] = Array.from({ length: NUMERO_FASI }, (_, indice) => {
    const soglia = perFase * giornalieri;
    return {
      numero: indice + 1,
      nome: NOMI_FASI[indice] ?? `Phase ${indice + 1}`,
      obiettivo: creato.label || 'Follow the plan as prescribed',
      durataGiorniStimata: perFase,
      sogliaRp: soglia,
      bonusGemme: Math.round(soglia * BONUS_FINE_FASE),
      esercizi,
      farmaci,
      precauzioni: [],
    };
  });

  return {
    paziente,
    obiettivi: { breveTermine: creato.label || 'Complete the plan', lungoTermine: '' },
    dataInizio,
    fasi,
    nutrizione: { indicazioni: [] },
    rivalutazioni: [],
    // Everything that is not a selected weekday. `scoring.ts` already treats
    // these as recovery days, so no engine change is needed to honour them.
    giorniRiposoPrescritti: riposo,
    misureOutcome: [],
  };
}

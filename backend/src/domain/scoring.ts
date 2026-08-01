/**
 * The scoring engine. Pure: state in, state out. No disk, no Express, no clock
 * of its own — the caller passes the instant. It is the only part under test,
 * because it is the only part where a wrong number shows up on stage.
 *
 * The order of the rules here is not free: it is the five-level precedence of
 * README §5.2, and the whole design of the recovery day rests on it.
 */

import {
  ALLERTA_RIVALUTA_PIANO,
  ALLERTA_SENTI_FISIOTERAPISTA,
  MOLTIPLICATORE_BASE,
  MOLTIPLICATORE_PASSO,
  MOLTIPLICATORE_TETTO,
  RECUPERI_MANUALI_PER_FASE,
  RP_DIARIO,
  RP_ESERCIZI,
  RP_FARMACI,
  VAS_SOGLIA_RECUPERO,
} from './costanti.js';
import { aggiungiGiorni } from './tempo.js';
import type {
  Classificazione,
  DataISO,
  DatiPersistiti,
  Fase,
  GiornoCorrente,
  GiornoStorico,
  LivelloAllerta,
  Piano,
  StatoUtente,
} from './types.js';

// ---------------------------------------------------------------------------
// Multiplier
// ---------------------------------------------------------------------------

/**
 * `min(1 + 0.05 * max(streak - 1, 0), 5)`.
 *
 * The inner `max` is the whole point: without it a zeroed streak gives 0.95,
 * so breaking the streak would become a penalty instead of losing a bonus.
 */
export function moltiplicatore(streakGiorni: number): number {
  const cresciuto = MOLTIPLICATORE_BASE + MOLTIPLICATORE_PASSO * Math.max(streakGiorni - 1, 0);
  // Two decimals: 0.05 steps in binary floating point drift otherwise.
  return Math.round(Math.min(cresciuto, MOLTIPLICATORE_TETTO) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/**
 * The full notion of "checklist done": every block the plan prescribes today,
 * exercises included, regardless of whether the day is a recovery one.
 *
 * This is the one the streak and the precedence use. The `richiestoOggi` flag
 * in the API is presentation only — using it here would close a loop: a
 * recovery day drops the exercises, the checklist then looks complete, level 2
 * turns the day back to normal, and the exercises are required again.
 */
export function checklistCompleta(fase: Fase, giorno: GiornoCorrente): boolean {
  return eserciziCompleti(fase, giorno) && farmaciCompleti(fase, giorno) && giorno.diario !== null;
}

function eserciziCompleti(fase: Fase, giorno: GiornoCorrente): boolean {
  return fase.esercizi.every((e) => giorno.eserciziFatti.includes(e.id));
}

/** True when every dose of every prescribed drug is ticked. Vacuously true with no drugs. */
function farmaciCompleti(fase: Fase, giorno: GiornoCorrente): boolean {
  return fase.farmaci.every((f) => f.orario.every((o) => giorno.dosiPrese.includes(`${f.id}@${o}`)));
}

/**
 * Base RP of the day. All or nothing per block: two exercises out of three are
 * worth zero, not two thirds. A recovery day is worth zero, full stop — even
 * the blocks that were completed anyway.
 */
export function rpDelGiorno(fase: Fase, giorno: GiornoCorrente, recupero: boolean): number {
  if (recupero) return 0;
  let rp = 0;
  if (eserciziCompleti(fase, giorno)) rp += RP_ESERCIZI;
  if (fase.farmaci.length > 0 && farmaciCompleti(fase, giorno)) rp += RP_FARMACI;
  if (giorno.diario !== null) rp += RP_DIARIO;
  return rp;
}

// ---------------------------------------------------------------------------
// Day classification (README §5.2)
// ---------------------------------------------------------------------------

/**
 * Five levels, first match wins. The order is load-bearing:
 *
 *  1. prescribed rest or revaluation      -> recupero
 *  2. checklist complete                  -> normale, even with VAS 8
 *  3. diary with VAS >= 7                 -> recupero
 *  4. manual recovery, if budget left     -> recupero
 *  5. otherwise                           -> normale (streak dies if incomplete)
 *
 * Level 2 above level 3 is the rule that pays the work: whoever grits their
 * teeth and finishes gets the full RP, and the recovery day stays for whoever
 * actually stops.
 */
export function classificaGiorno(
  piano: Piano,
  fase: Fase,
  stato: StatoUtente,
  giorno: GiornoCorrente,
): Classificazione {
  const completa = checklistCompleta(fase, giorno);

  if (piano.giorniRiposoPrescritti.includes(giorno.data)) {
    return { tipoGiorno: 'recupero', motivoRecupero: 'riposo-prescritto', checklistCompleta: completa };
  }
  if (piano.rivalutazioni.some((r) => r.data === giorno.data)) {
    return { tipoGiorno: 'recupero', motivoRecupero: 'rivalutazione', checklistCompleta: completa };
  }
  if (completa) {
    return { tipoGiorno: 'normale', motivoRecupero: null, checklistCompleta: true };
  }
  if (giorno.diario !== null && giorno.diario.vas >= VAS_SOGLIA_RECUPERO) {
    // No cap: the alert rises, the freeze stays (README §5.2).
    return { tipoGiorno: 'recupero', motivoRecupero: 'dolore', checklistCompleta: false };
  }
  if (giorno.recuperoManuale !== null && stato.recuperiManualiUsatiInFase < RECUPERI_MANUALI_PER_FASE) {
    return { tipoGiorno: 'recupero', motivoRecupero: 'manuale', checklistCompleta: false };
  }
  return { tipoGiorno: 'normale', motivoRecupero: null, checklistCompleta: false };
}

/**
 * Pain alert scale. Reads a counter, returns a message: it never touches the
 * streak. A safety warning that carries a penalty is a warning users learn to
 * dodge, and in a clinical app that is the worst possible failure.
 */
export function livelloAllerta(giorniVasAltiConsecutivi: number): LivelloAllerta {
  if (giorniVasAltiConsecutivi >= ALLERTA_RIVALUTA_PIANO) return 'rivaluta-piano';
  if (giorniVasAltiConsecutivi >= ALLERTA_SENTI_FISIOTERAPISTA) return 'senti-fisioterapista';
  return 'nessuna';
}

/**
 * Consecutive days of high pain.
 *
 * Counted whenever the diary says VAS >= 7, no matter how the day was
 * classified — so someone who finishes the checklist with VAS 8 for three days
 * running still gets told to call the physio. It is safe to count it this
 * broadly precisely because the counter only drives the message (invariant 6).
 */
function contaVasAlti(precedente: number, giorno: GiornoCorrente): number {
  if (giorno.diario === null) return 0;
  return giorno.diario.vas >= VAS_SOGLIA_RECUPERO ? precedente + 1 : 0;
}

// ---------------------------------------------------------------------------
// End of day (README §5.6)
// ---------------------------------------------------------------------------

/**
 * Closes the open day and opens the next one. Returns a whole new state; the
 * input is never mutated.
 *
 * A recovery day exits early: zero RP, zero gems, streak untouched, multiplier
 * frozen, phase day not consumed. It is invisible to the system, and that
 * invisibility is exactly what makes it impossible to farm.
 */
export function chiudiGiornata(dati: DatiPersistiti): DatiPersistiti {
  const fase = faseCorrente(dati);
  const { giornoCorrente: giorno, stato } = dati;
  const classe = classificaGiorno(dati.piano, fase, stato, giorno);
  const recupero = classe.tipoGiorno === 'recupero';

  const rp = rpDelGiorno(fase, giorno, recupero);
  const vasAlti = contaVasAlti(stato.giorniVasAltiConsecutivi, giorno);

  // On a recovery day the multiplier is frozen, not recomputed: it grows only
  // on real days, which is why unlimited freezes open no exploit.
  const streak = recupero ? stato.streakGiorni : classe.checklistCompleta ? stato.streakGiorni + 1 : 0;
  const molt = recupero ? stato.moltiplicatoreAttuale : moltiplicatore(streak);
  const gemme = recupero ? stato.gemmePortafoglio : stato.gemmePortafoglio + rp * molt;

  const rpProgressoFase = stato.rpProgressoFase + rp;

  const nuovoStato: StatoUtente = {
    ...stato,
    rpProgressoFase,
    rpTotali: stato.rpTotali + rp,
    giorniFaseTrascorsi: recupero ? stato.giorniFaseTrascorsi : stato.giorniFaseTrascorsi + 1,
    gemmePortafoglio: gemme,
    streakGiorni: streak,
    moltiplicatoreAttuale: molt,
    // Only the manual reason spends budget: the clinical ones leave a trace the
    // physio can see, so they are unlimited.
    recuperiManualiUsatiInFase:
      classe.motivoRecupero === 'manuale'
        ? stato.recuperiManualiUsatiInFase + 1
        : stato.recuperiManualiUsatiInFase,
    giorniVasAltiConsecutivi: vasAlti,
    avanzamentoDisponibile: rpProgressoFase >= stato.sogliaFaseAttuale,
    ultimaGiornataChiusa: giorno.data,
  };

  const voce: GiornoStorico = {
    data: giorno.data,
    tipoGiorno: classe.tipoGiorno,
    motivoRecupero: classe.motivoRecupero,
    checklistCompleta: classe.checklistCompleta,
    blocchiCompletati: {
      esercizi: eserciziCompleti(fase, giorno),
      farmaci: fase.farmaci.length > 0 && farmaciCompleti(fase, giorno),
      diario: giorno.diario !== null,
    },
    rpGuadagnati: rp,
    gemmeGuadagnate: recupero ? 0 : rp * molt,
    moltiplicatoreApplicato: molt,
    streakGiorni: streak,
    vas: giorno.diario?.vas ?? null,
    faseRaggiunta: stato.faseRaggiunta,
  };

  return {
    ...dati,
    stato: nuovoStato,
    giornoCorrente: nuovoGiorno(aggiungiGiorni(giorno.data, 1)),
    storico: [...dati.storico, voce],
  };
}

/** An empty checklist for a new day. */
export function nuovoGiorno(data: DataISO): GiornoCorrente {
  return { data, eserciziFatti: [], dosiPrese: [], diario: null, recuperoManuale: null };
}

/**
 * Manually finalises today without advancing to the next day.
 *
 * Runs the same scoring math as `chiudiGiornata` — streak, gems, multiplier,
 * RP — but keeps `giornoCorrente` at today's date and sets `finalizzato: true`.
 * `sincronizzaGiornata` checks this flag and skips re-scoring tomorrow morning.
 *
 * Only callable when `checklistCompleta` is true (enforced by the route).
 */
export function finalizzaGiornata(dati: DatiPersistiti): DatiPersistiti {
  const fase = faseCorrente(dati);
  const { giornoCorrente: giorno, stato } = dati;
  const classe = classificaGiorno(dati.piano, fase, stato, giorno);
  const recupero = classe.tipoGiorno === 'recupero';

  const rp = rpDelGiorno(fase, giorno, recupero);
  const vasAlti = contaVasAlti(stato.giorniVasAltiConsecutivi, giorno);

  const streak = recupero ? stato.streakGiorni : classe.checklistCompleta ? stato.streakGiorni + 1 : 0;
  const molt = recupero ? stato.moltiplicatoreAttuale : moltiplicatore(streak);
  const gemme = recupero ? stato.gemmePortafoglio : stato.gemmePortafoglio + rp * molt;
  const rpProgressoFase = stato.rpProgressoFase + rp;

  const nuovoStato: StatoUtente = {
    ...stato,
    rpProgressoFase,
    rpTotali: stato.rpTotali + rp,
    giorniFaseTrascorsi: recupero ? stato.giorniFaseTrascorsi : stato.giorniFaseTrascorsi + 1,
    gemmePortafoglio: gemme,
    streakGiorni: streak,
    moltiplicatoreAttuale: molt,
    recuperiManualiUsatiInFase:
      classe.motivoRecupero === 'manuale'
        ? stato.recuperiManualiUsatiInFase + 1
        : stato.recuperiManualiUsatiInFase,
    giorniVasAltiConsecutivi: vasAlti,
    avanzamentoDisponibile: rpProgressoFase >= stato.sogliaFaseAttuale,
    ultimaGiornataChiusa: giorno.data,
  };

  const voce: GiornoStorico = {
    data: giorno.data,
    tipoGiorno: classe.tipoGiorno,
    motivoRecupero: classe.motivoRecupero,
    checklistCompleta: classe.checklistCompleta,
    blocchiCompletati: {
      esercizi: eserciziCompleti(fase, giorno),
      farmaci: fase.farmaci.length > 0 && farmaciCompleti(fase, giorno),
      diario: giorno.diario !== null,
    },
    rpGuadagnati: rp,
    gemmeGuadagnate: recupero ? 0 : rp * molt,
    moltiplicatoreApplicato: molt,
    streakGiorni: streak,
    vas: giorno.diario?.vas ?? null,
    faseRaggiunta: stato.faseRaggiunta,
  };

  return {
    ...dati,
    stato: nuovoStato,
    giornoCorrente: { ...dati.giornoCorrente, finalizzato: true },
    storico: [...dati.storico, voce],
  };
}

/**
 * Confirms the level-up: pays the end-of-phase bonus and moves to the next
 * phase. In the demo this is auto-confirmed, in reality the physio signs it off.
 *
 * The leftover RP above the threshold carry into the new phase — the progress
 * never goes backwards, not even by a day's worth of overshoot.
 */
export function avanzaFase(dati: DatiPersistiti): DatiPersistiti {
  const { stato } = dati;
  const completata = faseCorrente(dati);
  const successiva = dati.piano.fasi[stato.faseRaggiunta];

  // Bonus is the flat, pre-announced figure from the plan, never multiplied.
  const gemme = stato.gemmePortafoglio + completata.bonusGemme;
  const avanzo = stato.rpProgressoFase - completata.sogliaRp;

  if (!successiva) {
    // Programme finished: pay the last bonus and stop suggesting an advance.
    return {
      ...dati,
      stato: { ...stato, gemmePortafoglio: gemme, avanzamentoDisponibile: false },
    };
  }

  return {
    ...dati,
    stato: {
      ...stato,
      faseRaggiunta: successiva.numero,
      sogliaFaseAttuale: successiva.sogliaRp,
      rpProgressoFase: Math.max(avanzo, 0),
      giorniFaseTrascorsi: 0,
      gemmePortafoglio: gemme,
      // Budget of manual recoveries refills with the new phase.
      recuperiManualiUsatiInFase: 0,
      // The multiplier is NOT reset here: success must not be penalised.
      avanzamentoDisponibile: false,
    },
  };
}

export function faseCorrente(dati: DatiPersistiti): Fase {
  const fase = dati.piano.fasi[dati.stato.faseRaggiunta - 1];
  if (!fase) throw new Error(`fase ${dati.stato.faseRaggiunta} assente nel piano`);
  return fase;
}

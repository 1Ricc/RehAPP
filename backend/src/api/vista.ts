/**
 * Shapes the persisted state into what the screens read.
 *
 * This module only shapes: every judgement (what kind of day it is, what the
 * checklist is worth) comes from `domain/scoring.ts`, so the screen and the
 * engine can never disagree. Gems leave from here floored, always.
 */

import {
  badge,
  benefitInApp,
  coloreProfilo,
  prossimoBadge,
  prossimoBenefit,
} from '../domain/benefit.js';
import { RP_DIARIO, RP_ESERCIZI, RP_FARMACI } from '../domain/costanti.js';
import { catalogo, prossimaRicompensa } from '../domain/negozio.js';
import { classificaGiorno, faseCorrente, livelloAllerta, moltiplicatore, rpDelGiorno } from '../domain/scoring.js';
import { aggiungiGiorni } from '../domain/tempo.js';
import type {
  Allerta,
  BarraStato,
  BloccoChecklist,
  CardFase,
  DatiPersistiti,
  Fase,
  GiornoInCorso,
  RispostaBadge,
  RispostaNegozio,
  RispostaStato,
  RispostaStorico,
  RispostaVoucher,
  TipoGiorno,
} from '../domain/types.js';

export function componiStato(dati: DatiPersistiti): RispostaStato {
  if (dati.piano === null) return statoSenzaPiano(dati);
  const { piano, stato, giornoCorrente } = dati;
  const fase = faseCorrente(dati);
  const classe = classificaGiorno(piano, fase, stato, giornoCorrente);
  const tipoGiorno = classe.tipoGiorno;

  const blocchi = componiBlocchi(fase, dati, tipoGiorno);
  const oggi: GiornoInCorso = {
    data: giornoCorrente.data,
    tipoGiorno,
    motivoRecupero: classe.motivoRecupero,
    blocchi,
    rpPotenziali: somma(blocchi.map((b) => b.rpOggi)),
    rpMaturati: rpDelGiorno(fase, giornoCorrente, tipoGiorno === 'recupero'),
    // The full notion, from the engine: never derived from `richiestoOggi`.
    checklistCompleta: classe.checklistCompleta,
    diario: giornoCorrente.diario,
    finalizzato: giornoCorrente.finalizzato === true,
  };

  const isNormal = tipoGiorno === 'normale';
  // After manual finalisation, stato already carries today's values — skip preview.
  const isFinalized = oggi.finalizzato;

  // RP: live while ticking, real after finalization.
  const rpVivi = isFinalized ? stato.rpProgressoFase : stato.rpProgressoFase + oggi.rpMaturati;

  // Streak/mult/gems: preview until checklist done, real after finalization.
  const streakVivo = isFinalized
    ? stato.streakGiorni
    : classe.checklistCompleta && isNormal
      ? stato.streakGiorni + 1
      : stato.streakGiorni;
  const moltVivo = isFinalized
    ? stato.moltiplicatoreAttuale
    : classe.checklistCompleta && isNormal
      ? moltiplicatore(streakVivo)
      : stato.moltiplicatoreAttuale;
  const gemmeVive = isFinalized
    ? Math.floor(stato.gemmePortafoglio)
    : Math.floor(stato.gemmePortafoglio + (isNormal ? oggi.rpMaturati * moltVivo : 0));

  const barra: BarraStato = {
    streakGiorni: streakVivo,
    moltiplicatore: moltVivo,
    moltiplicatoreCongelato: tipoGiorno === 'recupero',
    gemme: gemmeVive,
    rpProgressoFase: rpVivi,
    rpTotali: isFinalized ? stato.rpTotali : stato.rpTotali + oggi.rpMaturati,
  };

  const cardFase: CardFase = {
    numero: fase.numero,
    totaleFasi: piano.fasi.length,
    nome: fase.nome,
    obiettivo: fase.obiettivo,
    sogliaRp: stato.sogliaFaseAttuale,
    rpProgresso: rpVivi,
    rpMancanti: Math.max(stato.sogliaFaseAttuale - rpVivi, 0),
    bonusGemmeFine: fase.bonusGemme,
    giorniTrascorsi: stato.giorniFaseTrascorsi,
    durataGiorniStimata: fase.durataGiorniStimata,
    fineFasePrevista: aggiungiGiorni(
      giornoCorrente.data,
      Math.max(fase.durataGiorniStimata - stato.giorniFaseTrascorsi, 0),
    ),
    avanzamentoDisponibile:
      stato.avanzamentoDisponibile || rpVivi >= stato.sogliaFaseAttuale,
    precauzioni: fase.precauzioni,
  };

  const colore = coloreProfilo(stato.faseRaggiunta);

  return {
    paziente: piano.paziente,
    profilo: {
      nome: piano.paziente.nome,
      colore: colore.colore,
      etichettaColore: colore.etichetta,
    },
    fase: cardFase,
    senzaPiano: false,
    barra,
    oggi,
    allerta: componiAllerta(stato.giorniVasAltiConsecutivi),
    benefit: benefitInApp(stato.faseRaggiunta),
    prossimoBenefit: prossimoBenefit(stato.faseRaggiunta),
    // The other half of the home teaser: "177/200 per il buono farmacia".
    prossimaRicompensa: prossimaRicompensa(catalogo(dati)),
  };
}

/**
 * The shape the client gets before a plan exists. Every list is empty rather
 * than absent, so the UI renders its normal components with nothing in them
 * instead of needing a parallel set of null checks. Only `fase` is null, and
 * `senzaPiano` is the flag the client actually routes on.
 *
 * The benefits are still listed: they are gated on phase 1, which this state is
 * in, and showing them is part of the pitch for adopting a plan at all.
 */
function statoSenzaPiano(dati: DatiPersistiti): RispostaStato {
  const colore = coloreProfilo(dati.stato.faseRaggiunta);
  return {
    paziente: { nome: '', eta: 0, patologia: '', dataIntervento: dati.giornoCorrente.data },
    profilo: { nome: '', colore: colore.colore, etichettaColore: colore.etichetta },
    fase: null,
    senzaPiano: true,
    barra: {
      streakGiorni: 0,
      moltiplicatore: 1,
      moltiplicatoreCongelato: false,
      gemme: Math.floor(dati.stato.gemmePortafoglio),
      rpProgressoFase: 0,
      rpTotali: dati.stato.rpTotali,
    },
    oggi: {
      data: dati.giornoCorrente.data,
      tipoGiorno: 'normale',
      motivoRecupero: null,
      blocchi: [],
      rpPotenziali: 0,
      rpMaturati: 0,
      // Nothing prescribed is not the same as everything done: a day with no
      // plan must never pay a streak.
      checklistCompleta: false,
      diario: dati.giornoCorrente.diario,
      finalizzato: false,
    },
    allerta: componiAllerta(dati.stato.giorniVasAltiConsecutivi),
    benefit: benefitInApp(dati.stato.faseRaggiunta),
    prossimoBenefit: prossimoBenefit(dati.stato.faseRaggiunta),
    prossimaRicompensa: prossimaRicompensa(catalogo(dati)),
  };
}

/** GET /api/badges — earned ones plus the closest one still missing. */
export function componiBadge(dati: DatiPersistiti): RispostaBadge {
  const elenco = badge(dati);
  return { badge: elenco, prossimo: prossimoBadge(elenco) };
}

/** GET /api/store — the frontend reads `acquistabile` and nothing else. */
export function componiNegozio(dati: DatiPersistiti): RispostaNegozio {
  const ricompense = catalogo(dati);
  return {
    gemme: Math.floor(dati.stato.gemmePortafoglio),
    ricompense,
    prossima: prossimaRicompensa(ricompense),
  };
}

/** GET /api/vouchers — newest first, which is the order they are looked at. */
export function componiVoucher(dati: DatiPersistiti): RispostaVoucher {
  return { voucher: [...dati.voucher].reverse() };
}

function componiBlocchi(
  fase: Fase,
  dati: DatiPersistiti,
  tipoGiorno: TipoGiorno,
): BloccoChecklist[] {
  const { giornoCorrente } = dati;
  const recupero = tipoGiorno === 'recupero';
  const blocchi: BloccoChecklist[] = [];

  blocchi.push({
    id: 'esercizi',
    titolo: 'Exercises',
    rp: RP_ESERCIZI,
    rpOggi: recupero ? 0 : RP_ESERCIZI,
    // On a recovery day exercises are struck through: "non richiesti oggi".
    richiestoOggi: !recupero,
    completo:
      fase.esercizi.length > 0 &&
      fase.esercizi.every((e) => giornoCorrente.eserciziFatti.includes(e.id)),
    voci: fase.esercizi.map((e) => ({
      id: e.id,
      etichetta: e.nome,
      dettaglio: e.durataMinuti
        ? `${e.durataMinuti} min`
        : `${e.serie} sets × ${e.ripetizioni} reps`,
      fatto: giornoCorrente.eserciziFatti.includes(e.id),
    })),
  });

  // Phases 3-4 suspend the drug: no block at all rather than an empty one that
  // would be trivially complete and worth a free 4 RP. See the note in fixture.ts.
  if (fase.farmaci.length > 0) {
    const dosi = fase.farmaci.flatMap((f) =>
      f.orario.map((orario) => ({
        id: `${f.id}@${orario}`,
        etichetta: f.nome,
        dettaglio: orario,
        fatto: giornoCorrente.dosiPrese.includes(`${f.id}@${orario}`),
      })),
    );
    blocchi.push({
      id: 'farmaci',
      titolo: 'Medications',
      rp: RP_FARMACI,
      // Drugs and diary stay tickable on a recovery day, but they are worth 0
      // and the app says so before the user ticks them (README §5.2).
      rpOggi: recupero ? 0 : RP_FARMACI,
      richiestoOggi: true,
      completo: dosi.every((d) => d.fatto),
      voci: dosi,
    });
  }

  blocchi.push({
    id: 'diario',
    titolo: 'Pain diary',
    rp: RP_DIARIO,
    rpOggi: recupero ? 0 : RP_DIARIO,
    richiestoOggi: true,
    completo: giornoCorrente.diario !== null,
    voci: [
      {
        id: 'diario',
        etichetta: 'How does your knee feel today?',
        dettaglio: 'Ten seconds, every day',
        fatto: giornoCorrente.diario !== null,
      },
    ],
  });

  return blocchi;
}

/** The alert scale never touches the streak: it only changes what the app says. */
function componiAllerta(giorniVasAlti: number): Allerta {
  const livello = livelloAllerta(giorniVasAlti);
  const messaggi: Record<typeof livello, string> = {
    nessuna: '',
    'senti-fisioterapista': 'Third consecutive day of high pain. Contact your physiotherapist — the rest can wait.',
    'rivaluta-piano':
      'A week like this is not a pause. It may be worth reviewing the plan with your physiotherapist.',
  };
  return { livello, messaggio: messaggi[livello] };
}

/**
 * The last `giorni` closed days, oldest first — the order the calendar and the
 * chart draw in. Gems are floored here too, so no screen ever shows a decimal.
 */
export function componiStorico(dati: DatiPersistiti, giorni: number): RispostaStorico {
  return {
    giorni: dati.storico.slice(-giorni).map((g) => ({
      ...g,
      gemmeGuadagnate: Math.floor(g.gemmeGuadagnate),
    })),
  };
}

function somma(valori: number[]): number {
  return valori.reduce((totale, v) => totale + v, 0);
}

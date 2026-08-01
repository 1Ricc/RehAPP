/**
 * GET /api/state — everything the home needs, in one call.
 *
 * Block 1 of TODO-backend.md: this reads the persisted fixture and shapes it,
 * it does not score anything. Two things are still placeholders and are marked
 * as such below — the day classification and the RP maturing today — because
 * both belong to `src/domain/scoring.ts` (block 3). When that module lands, the
 * two helpers here get deleted and the route calls it instead.
 */

import { Router } from 'express';

import {
  ALLERTA_RIVALUTA_PIANO,
  ALLERTA_SENTI_FISIOTERAPISTA,
  RP_DIARIO,
  RP_FARMACI,
} from '../domain/costanti.js';
import { aggiungiGiorni } from '../domain/tempo.js';
import { load } from '../data/store.js';
import type {
  Allerta,
  BarraStato,
  BloccoChecklist,
  CardFase,
  DatiPersistiti,
  Fase,
  GiornoInCorso,
  RispostaStato,
  TipoGiorno,
} from '../domain/types.js';

export const rotteStato = Router();

rotteStato.get('/state', async (_req, res, next) => {
  try {
    res.json(componiStato(await load()));
  } catch (errore) {
    next(errore);
  }
});

export function componiStato(dati: DatiPersistiti): RispostaStato {
  const { piano, stato, giornoCorrente } = dati;
  const fase = faseCorrente(dati);

  const tipoGiorno = classificaProvvisoria();

  const blocchi = componiBlocchi(fase, dati, tipoGiorno);
  const oggi: GiornoInCorso = {
    data: giornoCorrente.data,
    tipoGiorno,
    motivoRecupero: null,
    blocchi,
    rpPotenziali: somma(blocchi.map((b) => b.rpOggi)),
    // All or nothing per block: a partial block is worth 0 (CLAUDE.md, invariant 4).
    rpMaturati: somma(blocchi.filter((b) => b.completo).map((b) => b.rpOggi)),
    checklistCompleta: blocchi.every((b) => !b.richiestoOggi || b.completo),
    diario: giornoCorrente.diario,
  };

  const barra: BarraStato = {
    streakGiorni: stato.streakGiorni,
    moltiplicatore: stato.moltiplicatoreAttuale,
    moltiplicatoreCongelato: tipoGiorno === 'recupero',
    // Floored: showing 200 with 199.6 in the wallet breaks the buy button.
    gemme: Math.floor(stato.gemmePortafoglio),
    rpProgressoFase: stato.rpProgressoFase,
    rpTotali: stato.rpTotali,
  };

  const cardFase: CardFase = {
    numero: fase.numero,
    totaleFasi: piano.fasi.length,
    nome: fase.nome,
    obiettivo: fase.obiettivo,
    sogliaRp: stato.sogliaFaseAttuale,
    rpProgresso: stato.rpProgressoFase,
    rpMancanti: Math.max(stato.sogliaFaseAttuale - stato.rpProgressoFase, 0),
    bonusGemmeFine: fase.bonusGemme,
    giorniTrascorsi: stato.giorniFaseTrascorsi,
    durataGiorniStimata: fase.durataGiorniStimata,
    fineFasePrevista: aggiungiGiorni(
      giornoCorrente.data,
      Math.max(fase.durataGiorniStimata - stato.giorniFaseTrascorsi, 0),
    ),
    avanzamentoDisponibile: stato.avanzamentoDisponibile,
  };

  return {
    paziente: piano.paziente,
    fase: cardFase,
    barra,
    oggi,
    allerta: componiAllerta(stato.giorniVasAltiConsecutivi),
  };
}

/**
 * PLACEHOLDER (blocco 3): replaced by classificaGiorno(), with the five-level
 * precedence of README §5.2. Until then every day is a normal one.
 */
function classificaProvvisoria(): TipoGiorno {
  return 'normale';
}

function faseCorrente(dati: DatiPersistiti): Fase {
  const fase = dati.piano.fasi[dati.stato.faseRaggiunta - 1];
  if (!fase) {
    throw new Error(`fase ${dati.stato.faseRaggiunta} assente nel piano`);
  }
  return fase;
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
    titolo: 'Esercizi',
    rp: fase.rpEsercizi,
    rpOggi: recupero ? 0 : fase.rpEsercizi,
    // On a recovery day exercises are struck through: "non richiesti oggi".
    richiestoOggi: !recupero,
    completo:
      fase.esercizi.length > 0 &&
      fase.esercizi.every((e) => giornoCorrente.eserciziFatti.includes(e.id)),
    voci: fase.esercizi.map((e) => ({
      id: e.id,
      etichetta: e.nome,
      dettaglio: `${e.serie} serie × ${e.ripetizioni} ripetizioni`,
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
      titolo: 'Farmaci',
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
    titolo: 'Diario del dolore',
    rp: RP_DIARIO,
    rpOggi: recupero ? 0 : RP_DIARIO,
    richiestoOggi: true,
    completo: giornoCorrente.diario !== null,
    voci: [
      {
        id: 'diario',
        etichetta: 'Come va il ginocchio oggi',
        dettaglio: 'Dieci secondi, tutti i giorni',
        fatto: giornoCorrente.diario !== null,
      },
    ],
  });

  return blocchi;
}

/** The alert scale never touches the streak: it only changes what the app says. */
function componiAllerta(giorniVasAlti: number): Allerta {
  if (giorniVasAlti >= ALLERTA_RIVALUTA_PIANO) {
    return {
      livello: 'rivaluta-piano',
      messaggio:
        'Una settimana così non è una pausa. Vale la pena rivedere il piano con il fisioterapista.',
    };
  }
  if (giorniVasAlti >= ALLERTA_SENTI_FISIOTERAPISTA) {
    return {
      livello: 'senti-fisioterapista',
      messaggio: 'Terzo giorno di dolore alto. Senti il fisioterapista, il resto può aspettare.',
    };
  }
  return { livello: 'nessuna', messaggio: '' };
}

function somma(valori: number[]): number {
  return valori.reduce((totale, v) => totale + v, 0);
}

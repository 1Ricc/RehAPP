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
import { classificaGiorno, faseCorrente, livelloAllerta, rpDelGiorno } from '../domain/scoring.js';
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
  RispostaStato,
  RispostaStorico,
  TipoGiorno,
} from '../domain/types.js';

export function componiStato(dati: DatiPersistiti): RispostaStato {
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

  const colore = coloreProfilo(stato.faseRaggiunta);

  return {
    paziente: piano.paziente,
    profilo: {
      nome: piano.paziente.nome,
      colore: colore.colore,
      etichettaColore: colore.etichetta,
    },
    fase: cardFase,
    barra,
    oggi,
    allerta: componiAllerta(stato.giorniVasAltiConsecutivi),
    benefit: benefitInApp(stato.faseRaggiunta),
    prossimoBenefit: prossimoBenefit(stato.faseRaggiunta),
  };
}

/** GET /api/badges — earned ones plus the closest one still missing. */
export function componiBadge(dati: DatiPersistiti): RispostaBadge {
  const elenco = badge(dati);
  return { badge: elenco, prossimo: prossimoBadge(elenco) };
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
        ? `${e.durataMinuti} minuti`
        : `${e.serie} serie × ${e.ripetizioni} ripetizioni`,
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
  const livello = livelloAllerta(giorniVasAlti);
  const messaggi: Record<typeof livello, string> = {
    nessuna: '',
    'senti-fisioterapista': 'Terzo giorno di dolore alto. Senti il fisioterapista, il resto può aspettare.',
    'rivaluta-piano':
      'Una settimana così non è una pausa. Vale la pena rivedere il piano con il fisioterapista.',
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

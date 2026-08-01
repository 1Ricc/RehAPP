/**
 * Marco's plan, the only one in the MVP. Ricostruzione LCA, four clinical
 * phases, 84 working days.
 *
 * The plan is built from a start date instead of being a frozen constant: the
 * prescribed rest days and the revaluation visits have to fall inside the demo
 * window, otherwise the recovery day triggered "senza barare" (TODO §2) can
 * never be shown. Demo profiles anchor the plan wherever they need it.
 *
 * Two things worth knowing before editing this file:
 *
 *  - Every exercise is `frequenzaSettimanale: 7`. It is not laziness: the phase
 *    threshold is `giorni previsti x RP giornalieri attesi`, so the daily total
 *    must be the same every day. An exercise prescribed 3 times a week would
 *    make Monday worth more than Tuesday and no threshold would hold. A real
 *    plan varies the frequency; supporting it means making the threshold a sum
 *    over the calendar, which is a rewrite of the engine, not a data change.
 *
 *  - The calendar offsets below are the plan's nominal schedule. Real life
 *    slides them: every recovery day pushes the end of the phase one day
 *    further, which is exactly what `giorniFaseTrascorsi` tracks.
 */

import { RP_DIARIO, RP_ESERCIZI, RP_FARMACI } from '../../domain/costanti.js';
import { aggiungiGiorni } from '../../domain/tempo.js';
import type { DataISO, Esercizio, Farmaco, Fase, Piano } from '../../domain/types.js';

/** Ibuprofen, twice a day. Prescribed in the first two phases only. */
const IBUPROFENE: Farmaco = {
  id: 'far-ibuprofene',
  nome: 'Ibuprofene 400mg',
  orario: ['08:00', '20:00'],
};

const ESERCIZI_FASE_1: Esercizio[] = [
  {
    id: 'es-1-sollevamento',
    nome: 'Sollevamento gamba tesa',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Da sdraiato, ginocchio bloccato in estensione',
  },
  {
    id: 'es-1-flessione',
    nome: 'Flessione passiva ginocchio',
    serie: 2,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
    note: 'Aiutandoti con le mani, senza forzare oltre il dolore',
  },
  {
    id: 'es-1-isometrica',
    nome: 'Contrazione isometrica del quadricipite',
    serie: 3,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: 'Dieci secondi di contrazione, dieci di pausa',
  },
];

const ESERCIZI_FASE_2: Esercizio[] = [
  {
    id: 'es-2-miniquat',
    nome: 'Mini squat alla parete',
    serie: 3,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: 'Scendi finché il ginocchio resta sopra i 60°',
  },
  {
    id: 'es-2-cyclette',
    nome: 'Cyclette senza resistenza',
    serie: 1,
    ripetizioni: 1,
    durataMinuti: 15,
    frequenzaSettimanale: 7,
    note: 'Sella alta, pedalata continua',
  },
  {
    id: 'es-2-flessione-attiva',
    nome: 'Flessione attiva assistita',
    serie: 3,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
    note: 'Obiettivo 90° entro fine fase',
  },
  {
    id: 'es-2-talloni',
    nome: 'Sollevamento sui talloni',
    serie: 3,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
    note: 'In piedi, appoggiandoti a un sostegno',
  },
];

const ESERCIZI_FASE_3: Esercizio[] = [
  {
    id: 'es-3-squat',
    nome: 'Squat a corpo libero',
    serie: 4,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: 'Schiena neutra, ginocchia in linea con i piedi',
  },
  {
    id: 'es-3-affondi',
    nome: 'Affondi in avanti',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Dieci per gamba, con controllo in discesa',
  },
  {
    id: 'es-3-step-up',
    nome: 'Step up su rialzo',
    serie: 3,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: 'Rialzo a 20 cm, salita lenta',
  },
  {
    id: 'es-3-ponte',
    nome: 'Ponte per i glutei',
    serie: 3,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
  },
  {
    id: 'es-3-equilibrio',
    nome: 'Equilibrio su una gamba',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Trenta secondi per ripetizione, occhi aperti',
  },
];

const ESERCIZI_FASE_4: Esercizio[] = [
  {
    id: 'es-4-corsa',
    nome: 'Corsa leggera',
    serie: 1,
    ripetizioni: 1,
    durataMinuti: 20,
    frequenzaSettimanale: 7,
    note: 'Su superficie piana, ritmo conversazionale',
  },
  {
    id: 'es-4-monopodalico',
    nome: 'Squat monopodalico',
    serie: 3,
    ripetizioni: 8,
    frequenzaSettimanale: 7,
    note: 'Otto per gamba, senza cedimenti del ginocchio verso l’interno',
  },
  {
    id: 'es-4-salti',
    nome: 'Salti a due piedi',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Atterraggio morbido, ginocchia flesse',
  },
  {
    id: 'es-4-direzione',
    nome: 'Cambi di direzione',
    serie: 4,
    ripetizioni: 6,
    frequenzaSettimanale: 7,
    note: 'Andature laterali e diagonali, andatura controllata',
  },
];

/** Everything that defines a phase except its derived numbers. */
interface BozzaFase {
  numero: number;
  nome: string;
  obiettivo: string;
  durataGiorniStimata: number;
  esercizi: Esercizio[];
  farmaci: Farmaco[];
  precauzioni: string[];
}

const BOZZE: BozzaFase[] = [
  {
    numero: 1,
    nome: 'Fase acuta / protettiva',
    obiettivo: 'Controllo dolore e gonfiore, mobilità protetta',
    durataGiorniStimata: 14,
    esercizi: ESERCIZI_FASE_1,
    farmaci: [IBUPROFENE],
    precauzioni: ['Non caricare peso completo senza stampelle', 'Ghiaccio 3 volte al giorno'],
  },
  {
    numero: 2,
    nome: 'Recupero mobilità',
    obiettivo: 'Recuperare 90° di flessione e camminare senza stampelle',
    durataGiorniStimata: 21,
    esercizi: ESERCIZI_FASE_2,
    farmaci: [IBUPROFENE],
    precauzioni: [
      'Carico progressivo, fermati se compare gonfiore',
      'Niente rotazioni sul ginocchio in carico',
    ],
  },
  {
    numero: 3,
    nome: 'Rinforzo',
    obiettivo: 'Recuperare forza e controllo neuromuscolare',
    durataGiorniStimata: 28,
    esercizi: ESERCIZI_FASE_3,
    // Ibuprofen suspended from here on: no drug block, and the day is worth less.
    farmaci: [],
    precauzioni: ['Nessun gesto sportivo di contatto', 'Interrompi se il dolore supera 5'],
  },
  {
    numero: 4,
    nome: 'Funzionale / ritorno all’attività',
    obiettivo: 'Tornare a correre e praticare sport',
    durataGiorniStimata: 21,
    farmaci: [],
    esercizi: ESERCIZI_FASE_4,
    precauzioni: [
      'Ritorno allo sport solo dopo il test funzionale superato',
      'Riscaldamento obbligatorio prima della corsa',
    ],
  },
];

/**
 * Prescribed rest days, as calendar offsets from day 1 of the plan.
 *
 * Days 1 to 9 are deliberately clear: the first seven days have to reproduce
 * the table in README §5.1 — 154 RP and 177.1 gems on day 7 — and a rest day
 * in there would break the number the pitch quotes.
 */
const RIPOSI_PRESCRITTI = [10, 24, 31, 38, 48, 55, 62, 69, 81, 88];

/** Revaluation visits: one at the end of each phase, where the level-up is confirmed. */
const RIVALUTAZIONI = [
  { offset: 16, conFisioterapista: 'Dott. Rossi' },
  { offset: 41, conFisioterapista: 'Dott. Rossi' },
  { offset: 74, conFisioterapista: 'Dott.ssa Bianchi' },
  { offset: 98, conFisioterapista: 'Dott. Rossi' },
];

/**
 * Builds the plan anchored to `dataInizio`, the first day of phase 1.
 *
 * Thresholds and bonuses are computed, never typed by hand: the whole point of
 * `soglia = giorni x RP giornalieri` is that the two cannot drift apart. Change
 * the drugs or the exercise block and the thresholds follow on their own.
 */
export function creaPianoMarco(dataInizio: DataISO): Piano {
  const fasi: Fase[] = BOZZE.map((bozza) => {
    const rpGiornalieri = RP_ESERCIZI + rpFarmaci(bozza) + RP_DIARIO;
    const sogliaRp = bozza.durataGiorniStimata * rpGiornalieri;
    return {
      numero: bozza.numero,
      nome: bozza.nome,
      obiettivo: bozza.obiettivo,
      durataGiorniStimata: bozza.durataGiorniStimata,
      sogliaRp,
      bonusGemme: Math.round(sogliaRp * 0.2),
      esercizi: bozza.esercizi,
      farmaci: bozza.farmaci,
      precauzioni: bozza.precauzioni,
    };
  });

  return {
    paziente: {
      nome: 'Marco',
      eta: 34,
      patologia: 'Ricostruzione LCA ginocchio destro',
      // Surgery the day before the plan starts.
      dataIntervento: aggiungiGiorni(dataInizio, -1),
    },
    obiettivi: {
      breveTermine:
        'Recuperare 90° di flessione e camminare senza stampelle entro 4 settimane',
      lungoTermine: 'Tornare a correre e praticare sport entro 6 mesi',
    },
    dataInizio,
    fasi,
    nutrizione: {
      // Out of the MVP: no points, never in the checklist.
      indicazioni: ['Apporto proteico 1.2-1.5g/kg', 'Idratazione 2L/giorno'],
    },
    rivalutazioni: RIVALUTAZIONI.map((r) => ({
      data: aggiungiGiorni(dataInizio, r.offset - 1),
      conFisioterapista: r.conFisioterapista,
    })),
    giorniRiposoPrescritti: RIPOSI_PRESCRITTI.map((o) => aggiungiGiorni(dataInizio, o - 1)),
    misureOutcome: [
      'Scala del dolore VAS',
      'Goniometria range di movimento',
      'Test funzionale a una gamba',
    ],
  };
}

/** A phase with no prescribed drug has no drug block at all, hence no 4 RP. */
function rpFarmaci(bozza: BozzaFase): number {
  return bozza.farmaci.length > 0 ? RP_FARMACI : 0;
}

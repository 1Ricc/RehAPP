/**
 * Marco's plan, the only one in the MVP. ACL reconstruction, four clinical
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
  nome: 'Ibuprofen 400mg',
  orario: ['08:00', '20:00'],
};

const ESERCIZI_FASE_1: Esercizio[] = [
  {
    id: 'es-1-sollevamento',
    nome: 'Straight Leg Raise',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Lying down, knee locked in extension',
  },
  {
    id: 'es-1-flessione',
    nome: 'Passive Knee Flexion',
    serie: 2,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
    note: 'Assisted with hands, do not push beyond pain',
  },
  {
    id: 'es-1-isometrica',
    nome: 'Isometric Quad Contraction',
    serie: 3,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: 'Ten seconds contraction, ten seconds rest',
  },
];

const ESERCIZI_FASE_2: Esercizio[] = [
  {
    id: 'es-2-miniquat',
    nome: 'Wall Mini Squat',
    serie: 3,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: 'Lower until knee stays above 60°',
  },
  {
    id: 'es-2-cyclette',
    nome: 'Stationary Bike (no resistance)',
    serie: 1,
    ripetizioni: 1,
    durataMinuti: 15,
    frequenzaSettimanale: 7,
    note: 'High seat, continuous pedalling',
  },
  {
    id: 'es-2-flessione-attiva',
    nome: 'Assisted Active Flexion',
    serie: 3,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
    note: 'Target 90° by end of phase',
  },
  {
    id: 'es-2-talloni',
    nome: 'Heel Raise',
    serie: 3,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
    note: 'Standing, holding support',
  },
];

const ESERCIZI_FASE_3: Esercizio[] = [
  {
    id: 'es-3-squat',
    nome: 'Bodyweight Squat',
    serie: 4,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: 'Neutral back, knees in line with feet',
  },
  {
    id: 'es-3-affondi',
    nome: 'Forward Lunges',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Ten per leg, controlled descent',
  },
  {
    id: 'es-3-step-up',
    nome: 'Step-Up',
    serie: 3,
    ripetizioni: 12,
    frequenzaSettimanale: 7,
    note: '20 cm step, slow ascent',
  },
  {
    id: 'es-3-ponte',
    nome: 'Glute Bridge',
    serie: 3,
    ripetizioni: 15,
    frequenzaSettimanale: 7,
  },
  {
    id: 'es-3-equilibrio',
    nome: 'Single-Leg Balance',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Thirty seconds per rep, eyes open',
  },
];

const ESERCIZI_FASE_4: Esercizio[] = [
  {
    id: 'es-4-corsa',
    nome: 'Light Jog',
    serie: 1,
    ripetizioni: 1,
    durataMinuti: 20,
    frequenzaSettimanale: 7,
    note: 'On flat surface, conversational pace',
  },
  {
    id: 'es-4-monopodalico',
    nome: 'Single-Leg Squat',
    serie: 3,
    ripetizioni: 8,
    frequenzaSettimanale: 7,
    note: 'Eight per leg, no knee caving inward',
  },
  {
    id: 'es-4-salti',
    nome: 'Two-Foot Jumps',
    serie: 3,
    ripetizioni: 10,
    frequenzaSettimanale: 7,
    note: 'Soft landing, knees bent',
  },
  {
    id: 'es-4-direzione',
    nome: 'Direction Changes',
    serie: 4,
    ripetizioni: 6,
    frequenzaSettimanale: 7,
    note: 'Lateral and diagonal movements, controlled pace',
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
    nome: 'Acute / Protective Phase',
    obiettivo: 'Pain and swelling control, protected mobility',
    durataGiorniStimata: 14,
    esercizi: ESERCIZI_FASE_1,
    farmaci: [IBUPROFENE],
    precauzioni: ['No full weight-bearing without crutches', 'Ice 3 times a day'],
  },
  {
    numero: 2,
    nome: 'Mobility Recovery',
    obiettivo: 'Recover 90° of flexion and walk without crutches',
    durataGiorniStimata: 21,
    esercizi: ESERCIZI_FASE_2,
    farmaci: [IBUPROFENE],
    precauzioni: [
      'Progressive loading, stop if swelling appears',
      'No rotations on a loaded knee',
    ],
  },
  {
    numero: 3,
    nome: 'Strengthening',
    obiettivo: 'Recover strength and neuromuscular control',
    durataGiorniStimata: 28,
    esercizi: ESERCIZI_FASE_3,
    // Ibuprofen suspended from here on: no drug block, and the day is worth less.
    farmaci: [],
    precauzioni: ['No contact sports movements', 'Stop if pain exceeds 5'],
  },
  {
    numero: 4,
    nome: 'Functional / Return to Activity',
    obiettivo: 'Return to running and sport',
    durataGiorniStimata: 21,
    farmaci: [],
    esercizi: ESERCIZI_FASE_4,
    precauzioni: [
      'Return to sport only after passing the functional test',
      'Mandatory warm-up before running',
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
  { offset: 16, conFisioterapista: 'Dr. Rossi' },
  { offset: 41, conFisioterapista: 'Dr. Rossi' },
  { offset: 74, conFisioterapista: 'Dr. Bianchi' },
  { offset: 98, conFisioterapista: 'Dr. Rossi' },
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
      patologia: 'Right knee ACL reconstruction',
      // Surgery the day before the plan starts.
      dataIntervento: aggiungiGiorni(dataInizio, -1),
    },
    obiettivi: {
      breveTermine: 'Recover 90° of flexion and walk without crutches within 4 weeks',
      lungoTermine: 'Return to running and sport within 6 months',
    },
    dataInizio,
    fasi,
    nutrizione: {
      // Out of the MVP: no points, never in the checklist.
      indicazioni: ['Protein intake 1.2-1.5g/kg', 'Hydration 2L/day'],
    },
    rivalutazioni: RIVALUTAZIONI.map((r) => ({
      data: aggiungiGiorni(dataInizio, r.offset - 1),
      conFisioterapista: r.conFisioterapista,
    })),
    giorniRiposoPrescritti: RIPOSI_PRESCRITTI.map((o) => aggiungiGiorni(dataInizio, o - 1)),
    misureOutcome: [
      'VAS Pain Scale',
      'Range of Motion Goniometry',
      'Single-leg functional test',
    ],
  };
}

/** A phase with no prescribed drug has no drug block at all, hence no 4 RP. */
function rpFarmaci(bozza: BozzaFase): number {
  return bozza.farmaci.length > 0 ? RP_FARMACI : 0;
}

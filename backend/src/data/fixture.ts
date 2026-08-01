/**
 * Static fixture, so the frontend can start before the engine exists.
 *
 * Scope: block 1 of TODO-backend.md. The real plan (all four phases with their
 * exercises, the prescribed rest days, the demo profiles) is block 2 — it will
 * replace `piano` here. What is already definitive are the phase numbers: they
 * come from the oracle in CLAUDE.md and the tests will check them.
 *
 * The user state reproduces day 7 of README §5.5 verbatim: 154 RP, 177.1 gems,
 * streak 7, x1.30. Anyone comparing the screen to the document sees the same
 * numbers.
 */

import { RECUPERI_MANUALI_PER_FASE, VERSIONE_STATO } from '../domain/costanti.js';
import { aggiungiGiorni, giornataLogica } from '../domain/tempo.js';
import type { DatiPersistiti, Fase, Piano, StatoUtente } from '../domain/types.js';

const FASI: Fase[] = [
  {
    numero: 1,
    nome: 'Fase acuta / protettiva',
    obiettivo: 'Controllo dolore e gonfiore, mobilità protetta',
    durataGiorniStimata: 14,
    rpEsercizi: 16,
    sogliaRp: 308,
    bonusGemme: 62,
    esercizi: [
      {
        id: 'es-1-sollevamento',
        nome: 'Sollevamento gamba tesa',
        serie: 3,
        ripetizioni: 10,
        frequenzaSettimanale: 7,
      },
      {
        id: 'es-1-flessione',
        nome: 'Flessione passiva ginocchio',
        serie: 2,
        ripetizioni: 15,
        frequenzaSettimanale: 7,
      },
      {
        id: 'es-1-isometrica',
        nome: 'Contrazione isometrica del quadricipite',
        serie: 3,
        ripetizioni: 12,
        frequenzaSettimanale: 7,
      },
    ],
    farmaci: [{ id: 'far-ibuprofene', nome: 'Ibuprofene 400mg', orario: ['08:00', '20:00'] }],
    precauzioni: ['Non caricare peso completo senza stampelle', 'Ghiaccio 3 volte al giorno'],
  },
  // Blocco 2: esercizi e precauzioni delle fasi 2-4.
  //
  // Da fase 3 l'antinfiammatorio è sospeso: niente blocco farmaci, quindi la
  // giornata vale 26 e 18 RP invece di 30 e 22, e le soglie scendono con lei
  // (728 e 378 invece di 840 e 462). Nessun punto di sostituzione: i punti
  // misurano il lavoro prescritto, e lì è una voce in meno.
  {
    numero: 2,
    nome: 'Recupero mobilità',
    obiettivo: 'Recuperare 90° di flessione e camminare senza stampelle',
    durataGiorniStimata: 21,
    rpEsercizi: 20,
    sogliaRp: 546,
    bonusGemme: 109,
    esercizi: [],
    farmaci: [],
    precauzioni: [],
  },
  {
    numero: 3,
    nome: 'Rinforzo',
    obiettivo: 'Recuperare forza e controllo neuromuscolare',
    durataGiorniStimata: 28,
    rpEsercizi: 24,
    sogliaRp: 728,
    bonusGemme: 146,
    esercizi: [],
    farmaci: [],
    precauzioni: [],
  },
  {
    numero: 4,
    nome: 'Funzionale / ritorno all’attività',
    obiettivo: 'Tornare a correre e praticare sport',
    durataGiorniStimata: 21,
    rpEsercizi: 16,
    sogliaRp: 378,
    bonusGemme: 76,
    esercizi: [],
    farmaci: [],
    precauzioni: [],
  },
];

const PIANO: Piano = {
  paziente: {
    nome: 'Marco',
    eta: 34,
    patologia: 'Ricostruzione LCA ginocchio destro',
    dataIntervento: '2026-06-01',
  },
  obiettivi: {
    breveTermine: 'Recuperare 90° di flessione e camminare senza stampelle entro 4 settimane',
    lungoTermine: 'Tornare a correre e praticare sport entro 6 mesi',
  },
  fasi: FASI,
  nutrizione: {
    indicazioni: ['Apporto proteico 1.2-1.5g/kg', 'Idratazione 2L/giorno'],
  },
  rivalutazioni: [{ data: '2026-06-15', conFisioterapista: 'Dott. Rossi' }],
  giorniRiposoPrescritti: [],
  misureOutcome: [
    'Scala del dolore VAS',
    'Goniometria range di movimento',
    'Test funzionale a una gamba',
  ],
};

const STATO: StatoUtente = {
  faseRaggiunta: 1,
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
  return {
    versione: VERSIONE_STATO,
    piano: PIANO,
    stato: {
      ...STATO,
      recuperiManualiUsatiInFase: Math.min(
        STATO.recuperiManualiUsatiInFase,
        RECUPERI_MANUALI_PER_FASE,
      ),
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
  };
}

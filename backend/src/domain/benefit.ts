/**
 * In-app benefits and badges (TODO-backend.md §7).
 *
 * These hang off the clinical progress, not off the gems: they are contents of
 * the app, not a purchase. The whole gate is one comparison — `faseRaggiunta >=
 * faseRichiesta` — written once, in `sbloccato()` below. No feature-flag system:
 * with four benefits and 24 hours, a flag system is more code than the thing it
 * would configure.
 *
 * Badges are computed from the state every time they are asked for, never
 * stored. A stored badge can go out of sync with the history that earned it; a
 * derived one cannot.
 */

import type { Badge, BenefitInApp, DatiPersistiti, GiornoStorico } from './types.js';

// ---------------------------------------------------------------------------
// In-app benefits
// ---------------------------------------------------------------------------

const CATALOGO_BENEFIT: Omit<BenefitInApp, 'sbloccato'>[] = [
  {
    id: 'grafico-dolore',
    nome: 'Pain Chart',
    descrizione: 'Track your daily VAS trend to share with your physiotherapist',
    faseRichiesta: 2,
  },
  {
    id: 'calendario-heatmap',
    nome: 'Activity Calendar',
    descrizione: 'All your days at a glance: completed, recovery, missed',
    faseRichiesta: 3,
  },
];

/** The one and only gate. */
function sbloccato(faseRaggiunta: number, faseRichiesta: number): boolean {
  return faseRaggiunta >= faseRichiesta;
}

export function benefitInApp(faseRaggiunta: number): BenefitInApp[] {
  return CATALOGO_BENEFIT.map((b) => ({ ...b, sbloccato: sbloccato(faseRaggiunta, b.faseRichiesta) }));
}

/** The teaser on the home: what comes next, so the progress bar means something. */
export function prossimoBenefit(faseRaggiunta: number): BenefitInApp | null {
  return benefitInApp(faseRaggiunta).find((b) => !b.sbloccato) ?? null;
}

/**
 * Profile name colour, one per phase. The cheapest possible "avatar
 * customisation": it costs a hex string and it is visible on every screen.
 */
const COLORI = [
  { colore: '#64748b', etichetta: 'Slate' },
  { colore: '#10b981', etichetta: 'Green' },
  { colore: '#3b82f6', etichetta: 'Blue' },
  { colore: '#f59e0b', etichetta: 'Gold' },
];

export function coloreProfilo(faseRaggiunta: number): { colore: string; etichetta: string } {
  return COLORI[Math.min(Math.max(faseRaggiunta, 1), COLORI.length) - 1]!;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** Longest run of consecutive days whose diary was filled, today included. */
function strisciaDiario(dati: DatiPersistiti): number {
  let massimo = 0;
  let corrente = 0;
  for (const g of dati.storico) {
    corrente = g.vas !== null ? corrente + 1 : 0;
    massimo = Math.max(massimo, corrente);
  }
  if (dati.giornoCorrente.diario !== null) massimo = Math.max(massimo, corrente + 1);
  return massimo;
}

/** The longest streak ever reached, which is what a badge rewards — not today's. */
function streakMassimo(dati: DatiPersistiti): number {
  return dati.storico.reduce(
    (massimo: number, g: GiornoStorico) => Math.max(massimo, g.streakGiorni),
    dati.stato.streakGiorni,
  );
}

export function badge(dati: DatiPersistiti): Badge[] {
  const streak = streakMassimo(dati);
  const diario = strisciaDiario(dati);
  const fasiChiuse = dati.stato.faseRaggiunta - 1;

  const definizioni: Omit<Badge, 'ottenuto'>[] = [
    {
      id: 'prima-settimana',
      nome: 'First Week',
      descrizione: 'Seven days in a row without missing anything',
      progresso: Math.min(streak, 7),
      obiettivo: 7,
    },
    {
      id: 'fase-superata',
      nome: 'Phase Cleared',
      descrizione: 'You completed a phase of the clinical path',
      progresso: Math.min(fasiChiuse, 1),
      obiettivo: 1,
    },
    {
      id: 'streak-30',
      nome: 'Thirty Days',
      descrizione: 'A full month sticking to the plan',
      progresso: Math.min(streak, 30),
      obiettivo: 30,
    },
    {
      id: 'diario-14',
      nome: 'Faithful Diary',
      descrizione: 'Fourteen consecutive days with the diary filled',
      progresso: Math.min(diario, 14),
      obiettivo: 14,
    },
  ];

  return definizioni.map((d) => ({ ...d, ottenuto: d.progresso >= d.obiettivo }));
}

/** The closest one still missing: the only one worth showing as a target. */
export function prossimoBadge(elenco: Badge[]): Badge | null {
  const mancanti = elenco.filter((b) => !b.ottenuto);
  if (mancanti.length === 0) return null;
  return mancanti.reduce((migliore, b) =>
    b.progresso / b.obiettivo > migliore.progresso / migliore.obiettivo ? b : migliore,
  );
}

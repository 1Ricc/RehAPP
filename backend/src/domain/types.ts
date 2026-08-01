/**
 * Shared domain contract. The frontend imports the same declarations, so any
 * change here is a change to the API contract.
 *
 * Domain vocabulary stays Italian (fase, gemme, recupero) because it mirrors
 * README.md, which is the authority on the design.
 */

// ---------------------------------------------------------------------------
// Plan (README §4)
// ---------------------------------------------------------------------------

/** Local calendar date, `YYYY-MM-DD`. */
export type DataISO = string;

/** Time of day, `HH:MM`, 24h, local. */
export type Orario = string;

export interface Paziente {
  nome: string;
  eta: number;
  patologia: string;
  dataIntervento: DataISO;
}

export interface Obiettivi {
  breveTermine: string;
  lungoTermine: string;
}

export interface Esercizio {
  id: string;
  nome: string;
  serie: number;
  ripetizioni: number;
  /** Set on time-based work (bike, jogging) instead of reps. */
  durataMinuti?: number;
  /**
   * FITT frequency. In the MVP it is always 7: the daily total has to be the
   * same every day, otherwise the phase thresholds — days x daily RP — would
   * depend on the weekday. See the note in seed/piano-marco.ts.
   */
  frequenzaSettimanale: number;
  note?: string;
}

export interface Farmaco {
  id: string;
  nome: string;
  /** Every dose of the day. All of them are required for the 4 RP block. */
  orario: Orario[];
}

/**
 * A clinical phase. Doubles as the game's level (README §5.1). The threshold is
 * `durataGiorniStimata * (RP_ESERCIZI + drug block, if any + RP_DIARIO)`: the RP
 * of a block never change, only which blocks the phase prescribes.
 */
export interface Fase {
  /** 1-based, matches `faseRaggiunta` in StatoUtente. */
  numero: number;
  nome: string;
  obiettivo: string;
  durataGiorniStimata: number;
  /**
   * RP needed to leave this phase: `durataGiorniStimata` x the daily total.
   * 308 / 462 / 504 / 378 — the last two are lower because from phase 3 the
   * drug block is gone. Never typed by hand, always derived.
   */
  sogliaRp: number;
  /** Flat 20% of the threshold, paid on phase confirmation: 62 / 92 / 101 / 76. */
  bonusGemme: number;
  esercizi: Esercizio[];
  farmaci: Farmaco[];
  precauzioni: string[];
}

/** Out of the MVP: no points, never in the checklist (CLAUDE.md, invariant 9). */
export interface Nutrizione {
  indicazioni: string[];
}

export interface Rivalutazione {
  data: DataISO;
  conFisioterapista: string;
}

export interface Piano {
  paziente: Paziente;
  obiettivi: Obiettivi;
  /** Day 1 of phase 1. Rest days and revaluations are laid out from here. */
  dataInizio: DataISO;
  fasi: Fase[];
  nutrizione: Nutrizione;
  /** Visit dates. A day matching one of these is a recovery day, no budget spent. */
  rivalutazioni: Rivalutazione[];
  /** Prescribed rest days. Same effect as a rivalutazione. */
  giorniRiposoPrescritti: DataISO[];
  misureOutcome: string[];
}

// ---------------------------------------------------------------------------
// Day classification (README §5.2)
// ---------------------------------------------------------------------------

/**
 * The two outcomes of `classifica(giorno)`. A `normale` day can still be
 * incomplete — that is a lost streak, not a third kind of day. The calendar
 * tells full days from lost ones through `checklistCompleta`.
 */
export type TipoGiorno = 'normale' | 'recupero';

/**
 * Why a day was frozen. The first three are clinical, hence unlimited;
 * `manuale` is the only one on a budget (1 per phase).
 */
export type MotivoRecupero =
  | 'riposo-prescritto'
  | 'rivalutazione'
  | 'dolore'
  | 'manuale';

/** Pain alert scale (README §5.2). Never touches the streak. */
export type LivelloAllerta = 'nessuna' | 'senti-fisioterapista' | 'rivaluta-piano';

/** What `classificaGiorno()` decided about a day, before anything is scored. */
export interface Classificazione {
  tipoGiorno: TipoGiorno;
  motivoRecupero: MotivoRecupero | null;
  /**
   * The full notion: every block the plan prescribes, exercises included,
   * ignoring whether the day is a recovery one. This is what the streak reads,
   * never `BloccoChecklist.richiestoOggi`.
   */
  checklistCompleta: boolean;
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/** Scoring blocks. All-or-nothing, one by one (CLAUDE.md, invariant 4). */
export type IdBlocco = 'esercizi' | 'farmaci' | 'diario';

export interface Diario {
  /** Pain, 0-10. From 7 up it triggers a recovery day, unless the checklist is full. */
  vas: number;
  nota?: string;
  compilatoAlle: string;
}

/**
 * The day currently open. Everything here is wiped and rebuilt when the day
 * rolls over at 02:00 (CLAUDE.md, invariant 8).
 */
export interface GiornoCorrente {
  /** Logical day this checklist belongs to, not the wall-clock date. */
  data: DataISO;
  /** Exercise ids ticked so far. */
  eserciziFatti: string[];
  /** Ticked doses, as `${farmacoId}@${orario}` — every dose counts separately. */
  dosiPrese: string[];
  diario: Diario | null;
  /** Manual recovery declared by the user, at any time of the day. */
  recuperoManuale: { motivo: string; dichiaratoAlle: string } | null;
}

// ---------------------------------------------------------------------------
// User state (README §5.5)
// ---------------------------------------------------------------------------

export interface StatoUtente {
  /**
   * 1-based current phase. It never goes down, so it is also the single gate
   * for in-app benefits: `faseRaggiunta >= n` (CLAUDE.md, context constraints).
   */
  faseRaggiunta: number;
  /** Frozen when the phase starts: `piano.fasi[faseRaggiunta - 1].sogliaRp`. */
  sogliaFaseAttuale: number;
  /** RP inside the current phase. Never decreases, never multiplied. */
  rpProgressoFase: number;
  /** Lifetime RP, across phases. The number that "never goes back" in the copy. */
  rpTotali: number;
  /** Only used for the projected end-of-phase date. A recovery day does not consume it. */
  giorniFaseTrascorsi: number;
  /** Kept with decimals internally, floored on the way out of the API. */
  gemmePortafoglio: number;
  streakGiorni: number;
  /** `min(1 + 0.05 * max(streak - 1, 0), 5)`. Never below 1. */
  moltiplicatoreAttuale: number;
  /** Reset to 0 on phase advance. */
  recuperiManualiUsatiInFase: number;
  /** Drives the alert scale only, never the streak. */
  giorniVasAltiConsecutivi: number;
  /** True when the threshold is reached and the level-up is waiting for confirmation. */
  avanzamentoDisponibile: boolean;
  /** Last logical day closed by the engine, `null` before day one. */
  ultimaGiornataChiusa: DataISO | null;
}

// ---------------------------------------------------------------------------
// History (feeds calendar and pain chart)
// ---------------------------------------------------------------------------

export interface GiornoStorico {
  data: DataISO;
  tipoGiorno: TipoGiorno;
  motivoRecupero: MotivoRecupero | null;
  /** Tells a full day from a lost one on a `normale` day. */
  checklistCompleta: boolean;
  /** Which blocks paid out. All-or-nothing, so these are the RP breakdown. */
  blocchiCompletati: Record<IdBlocco, boolean>;
  /** Base RP earned, never multiplied. Zero on a recovery day. */
  rpGuadagnati: number;
  /** `rpGuadagnati * moltiplicatoreApplicato`, decimals kept. */
  gemmeGuadagnate: number;
  moltiplicatoreApplicato: number;
  /** Streak after closing this day. */
  streakGiorni: number;
  vas: number | null;
  faseRaggiunta: number;
}

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

export interface DatiPersistiti {
  /** Bumped when the shape changes, so a stale state.json fails loudly. */
  versione: number;
  piano: Piano;
  stato: StatoUtente;
  giornoCorrente: GiornoCorrente;
  storico: GiornoStorico[];
  voucher: Voucher[];
}

/**
 * A redeemed reward. Mock by design, as the brief allows: the code is generated
 * and nothing is ever sent anywhere. It is stored, not derived, because it
 * records an event — unlike a badge, which restates a fact.
 */
export interface Voucher {
  id: string;
  ricompensaId: string;
  nome: string;
  partner: string;
  /** `REHAPP-7K2M-9XQ4`. */
  codice: string;
  gemmeSpese: number;
  riscattatoIl: string;
}

// ---------------------------------------------------------------------------
// API contract — GET /api/state
// ---------------------------------------------------------------------------

export interface VoceChecklist {
  id: string;
  etichetta: string;
  dettaglio?: string;
  fatto: boolean;
}

export interface BloccoChecklist {
  id: IdBlocco;
  titolo: string;
  /** What the block is worth on a normal day. */
  rp: number;
  /** What it is worth today: zero on a recovery day, and the UI says so. */
  rpOggi: number;
  /** Every item ticked. Only then the RP are paid. */
  completo: boolean;
  /** False for exercises on a recovery day: shown struck through, "non richiesti oggi". */
  richiestoOggi: boolean;
  voci: VoceChecklist[];
}

/** The persistent top bar (README §6, home item 1). */
export interface BarraStato {
  streakGiorni: number;
  moltiplicatore: number;
  /** On a recovery day the multiplier shows as frozen, same value. */
  moltiplicatoreCongelato: boolean;
  /** Floored (CLAUDE.md, invariant 10). */
  gemme: number;
  rpProgressoFase: number;
  rpTotali: number;
}

/** The phase card (README §6, home item 2). */
export interface CardFase {
  numero: number;
  totaleFasi: number;
  nome: string;
  obiettivo: string;
  sogliaRp: number;
  rpProgresso: number;
  rpMancanti: number;
  bonusGemmeFine: number;
  giorniTrascorsi: number;
  durataGiorniStimata: number;
  /** Projection shown as "fine fase prevista il …"; a recovery day slides it. */
  fineFasePrevista: DataISO;
  avanzamentoDisponibile: boolean;
}

export interface Allerta {
  livello: LivelloAllerta;
  messaggio: string;
}

export interface GiornoInCorso {
  data: DataISO;
  tipoGiorno: TipoGiorno;
  motivoRecupero: MotivoRecupero | null;
  blocchi: BloccoChecklist[];
  /** RP available today: the sum of the blocks, zero on a recovery day. */
  rpPotenziali: number;
  /** RP already earned by completed blocks, if the day closed now. */
  rpMaturati: number;
  checklistCompleta: boolean;
  diario: Diario | null;
}

/**
 * Everything the home needs in one call. Stays light on purpose: history lives
 * in /api/history and is only fetched by the calendar and the chart.
 */
export interface RispostaStato {
  paziente: Paziente;
  /** Name plus the colour the current phase earned (README §5.3). */
  profilo: { nome: string; colore: string; etichettaColore: string };
  fase: CardFase;
  barra: BarraStato;
  oggi: GiornoInCorso;
  allerta: Allerta;
  /** All of them, unlocked or not: the locked ones are the teaser. */
  benefit: BenefitInApp[];
  /** The next one to unlock, for the home teaser. Null when they are all open. */
  prossimoBenefit: BenefitInApp | null;
  /** The nearest reward still out of reach: the "177/200" on the home. */
  prossimaRicompensa: Ricompensa | null;
}

/**
 * GET /api/history — calendar and pain chart. Kept out of /api/state so the
 * home stays at 2-3 KB and is only paid for when those tabs open.
 */
export interface RispostaStorico {
  giorni: GiornoStorico[];
}

/** An app feature gated on clinical progress, never on gems (README §5.3). */
export interface BenefitInApp {
  id: 'grafico-dolore' | 'calendario-heatmap';
  nome: string;
  descrizione: string;
  /** The whole gate: `faseRaggiunta >= faseRichiesta`. */
  faseRichiesta: number;
  sbloccato: boolean;
}

/** Always derived from the state, never stored, so it cannot fall out of sync. */
export interface Badge {
  id: string;
  nome: string;
  descrizione: string;
  ottenuto: boolean;
  progresso: number;
  obiettivo: number;
}

/** GET /api/badges */
export interface RispostaBadge {
  badge: Badge[];
  /** The closest one still missing, or null once they are all earned. */
  prossimo: Badge | null;
}

/** A store item with everything already decided server-side. */
export interface Ricompensa {
  id: string;
  nome: string;
  partner: string;
  descrizione: string;
  /** What it costs right now: it grows for the repeatable one. */
  costo: number;
  costoBase: number;
  faseRichiesta: number;
  /** The phase gate is met. */
  sbloccato: boolean;
  /** Unlocked *and* affordable: the buy button reads this and nothing else. */
  acquistabile: boolean;
  ripetibile: boolean;
  volteRiscattata: number;
  /** Zero when affordable. Drives the "177/200" progress on the home. */
  gemmeMancanti: number;
}

/** GET /api/store */
export interface RispostaNegozio {
  /** Floored, same as everywhere else. */
  gemme: number;
  ricompense: Ricompensa[];
  /** The nearest one still out of reach, for the home teaser. */
  prossima: Ricompensa | null;
}

/** GET /api/vouchers — newest first. */
export interface RispostaVoucher {
  voucher: Voucher[];
}

/** Every error, every route. Never a stack trace. */
export interface RispostaErrore {
  errore: string;
  messaggio: string;
}

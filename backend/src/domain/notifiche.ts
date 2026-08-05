/**
 * Notification engine (README §7, TODO-backend.md §8).
 *
 * Pure, like the scoring engine: state and an instant in, a queue out. Nothing
 * is stored — a notification is a fact about right now, and recomputing it is
 * cheaper than keeping it in sync.
 *
 * The order of this file is the order of the design: **silence first**. The
 * conditions under which the app says nothing are the designed part, not the
 * absence of design. Reminders come after, and only through what silence lets
 * through.
 *
 * Copy is picked deterministically from the variants, seeded on the notification
 * id: the wording changes between days and between events, but never between
 * two polls of the same event. Random-per-call would make the banner text
 * flicker while the user is reading it.
 */

import { catalogo } from './negozio.js';
import { classificaGiorno, checklistCompleta, faseCorrente, pianoDi } from './scoring.js';
import type { DatiPersistiti, Notifica, Silenzio, TipoNotifica } from './types.js';

/** README §7.1: never more than three in a day, whatever happens. */
const TETTO_GIORNALIERO = 3;

/** Rough minutes per exercise when the plan does not say. Used in the copy. */
const MINUTI_PER_ESERCIZIO = 4;

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * Two or three variants per event, so it does not sound recorded. No generative
 * model, no external call: a table and a hash.
 *
 * Rules that hold for every line (README §7.3): peer register, warm, short,
 * never blaming. Each one says what is **still within reach**, never what was
 * missed. Banned by construction: "hai fallito", "stai perdendo", "non hai
 * ancora", counting skipped days, sad faces.
 */
const COPY: Record<TipoNotifica, ((c: Contesto) => string)[]> = {
  farmaci: [
    () => 'Ibuprofene. Poi puoi tornare a dormire.',
    () => 'C’è la dose di stamattina. Trenta secondi.',
    (c) => `${c.nomeFarmaco}. Un attimo e sei a posto.`,
  ],
  'farmaci-sera': [
    () => 'Ultima dose della giornata.',
    (c) => `${c.nomeFarmaco}, poi la giornata è chiusa.`,
  ],
  esercizi: [
    (c) => `${c.quantiEsercizi} esercizi, ${c.minutiEsercizi} minuti. Il ginocchio non si allena da solo.`,
    (c) => `${c.minutiEsercizi} minuti di lavoro e la giornata gira.`,
    (c) => `Quando hai ${c.minutiEsercizi} minuti, ci sono ${c.quantiEsercizi} esercizi che ti aspettano.`,
  ],
  'manca-poco': [
    (c) => `Manca solo ${c.cosaManca}. Dieci secondi e la giornata è piena.`,
    (c) => `Ci sei quasi: resta ${c.cosaManca}.`,
  ],
  chiusura: [
    (c) =>
      `${c.verboMancare} ${c.cosaManca}: ${c.minutiEsercizi} minuti per tenere ${c.streak} giorni e il tuo ${c.moltiplicatore}.`,
    (c) => `${c.verboMancare} ${c.cosaManca}. Il tuo ${c.moltiplicatore} resta dov’è.`,
  ],
  'ripresa-dopo-recupero': [
    (c) => `Ieri ti sei fermato ed era la cosa giusta. Il tuo ${c.moltiplicatore} è ancora lì.`,
    (c) => `Ieri era un giorno di pausa vera. ${c.streak} giorni e ${c.moltiplicatore}: tutto al suo posto.`,
  ],
  'streak-perso': [
    (c) => `Lo streak riparte da zero. I tuoi ${c.rpTotali} RP no: quelli restano tutti.`,
    (c) => `Si ricomincia da uno. I ${c.rpTotali} RP di percorso non si toccano.`,
  ],
  assenza: [
    () => 'Come va il ginocchio?',
    () => 'Tutto bene? Basta il diario, se hai un minuto.',
    () => 'Come stai? Dimmi solo com’è il dolore oggi.',
  ],
  sblocco: [
    (c) => `Hai ${c.gemme} gemme. ${c.ricompensa} è tuo quando vuoi.`,
    (c) => `${c.ricompensa} è sbloccato: ti bastano le gemme che hai.`,
  ],
  'level-up': [
    (c) => `Fase ${c.fase}. Sei arrivato in fondo a questa, e hai ${c.bonus} gemme in più.`,
    (c) => `Hai chiuso la fase. Si passa a "${c.nomeFase}", con ${c.bonus} gemme di bonus.`,
  ],
};

interface Contesto {
  nomeFarmaco: string;
  quantiEsercizi: number;
  minutiEsercizi: number;
  cosaManca: string;
  /** Agrees with `cosaManca`: "Ti manca il diario" but "Ti mancano gli esercizi e il diario". */
  verboMancare: string;
  streak: number;
  moltiplicatore: string;
  rpTotali: string;
  gemme: number;
  ricompensa: string;
  fase: number;
  nomeFase: string;
  bonus: number;
}

/**
 * Stable pick: same id, same variant. The hash is trivial on purpose — this
 * chooses between three strings, not a cryptographic anything.
 */
function scegli(id: string, varianti: ((c: Contesto) => string)[], contesto: Contesto): string {
  let somma = 0;
  for (let i = 0; i < id.length; i++) somma = (somma * 31 + id.charCodeAt(i)) >>> 0;
  const scelta = varianti[somma % varianti.length]!;
  return scelta(contesto);
}

// ---------------------------------------------------------------------------
// Silence (README §7.1) — this comes first, and it is the point
// ---------------------------------------------------------------------------

/**
 * The quiet window, deduced from the drug times in the plan rather than
 * hardcoded: it ends when the first dose is due and starts two hours after the
 * last one. A phase with no drugs falls back to 22:00-08:00.
 */
export function finestraDiQuiete(dati: DatiPersistiti): { inizio: number; fine: number } {
  const ore = faseCorrente(dati)
    .farmaci.flatMap((f) => f.orario)
    .map((o) => Number(o.slice(0, 2)))
    .filter((n) => Number.isFinite(n));
  if (ore.length === 0) return { inizio: 22, fine: 8 };
  return { inizio: Math.min(Math.max(...ore) + 2, 23), fine: Math.min(...ore) };
}

function inQuiete(dati: DatiPersistiti, ora: number): boolean {
  const { inizio, fine } = finestraDiQuiete(dati);
  return ora >= inizio || ora < fine;
}

/**
 * Why the app is quiet right now, or null if it is not.
 *
 * The recovery-day case is the one that earns the whole design: reminding
 * someone of their exercises right after they reported severe pain destroys the
 * credibility of everything else. The engine reads the same `tipoGiorno` the
 * scoring does, so the silence is automatic and nobody has to remember it.
 */
export function silenzio(dati: DatiPersistiti, adesso: Date): Silenzio | null {
  const fase = faseCorrente(dati);
  const classe = classificaGiorno(pianoDi(dati), fase, dati.stato, dati.giornoCorrente);

  if (classe.tipoGiorno === 'recupero') {
    return {
      motivo: 'giorno-di-recupero',
      spiegazione:
        'Oggi la giornata è in pausa. L’app non chiede niente, tranne il messaggio di ripresa domani mattina.',
    };
  }
  if (checklistCompleta(fase, dati.giornoCorrente)) {
    return {
      motivo: 'checklist-completa',
      spiegazione: 'Hai finito tutto. Nessun altro promemoria fino a domani.',
    };
  }
  if (inQuiete(dati, adesso.getHours())) {
    const { inizio, fine } = finestraDiQuiete(dati);
    return {
      motivo: 'orario-notturno',
      spiegazione: `Finestra di quiete, dalle ${String(inizio).padStart(2, '0')}:00 alle ${String(fine).padStart(2, '0')}:00.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Absence (README §7.2) — inverse escalation
// ---------------------------------------------------------------------------

/** Trailing run of days on which nothing at all was ticked. */
export function giorniDiAssenza(dati: DatiPersistiti): number {
  let assenti = 0;
  for (let i = dati.storico.length - 1; i >= 0; i--) {
    const g = dati.storico[i]!;
    const toccato = g.blocchiCompletati.esercizi || g.blocchiCompletati.farmaci || g.vas !== null;
    if (toccato) break;
    assenti += 1;
  }
  return assenti;
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

function contesto(dati: DatiPersistiti, mancanti: string[]): Contesto {
  const fase = faseCorrente(dati);
  const minuti = fase.esercizi.reduce((t, e) => t + (e.durataMinuti ?? MINUTI_PER_ESERCIZIO), 0);
  const acquistabile = catalogo(dati).find((r) => r.acquistabile);
  const successiva = pianoDi(dati).fasi[dati.stato.faseRaggiunta - 1];

  return {
    nomeFarmaco: fase.farmaci[0]?.nome ?? 'La dose',
    quantiEsercizi: fase.esercizi.length,
    minutiEsercizi: minuti,
    cosaManca: elenca(mancanti),
    verboMancare: mancanti.length > 1 ? 'Ti mancano' : 'Ti manca',
    streak: dati.stato.streakGiorni,
    moltiplicatore: `×${dati.stato.moltiplicatoreAttuale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
    rpTotali: dati.stato.rpTotali.toLocaleString('it-IT'),
    gemme: Math.floor(dati.stato.gemmePortafoglio),
    ricompensa: acquistabile ? `${acquistabile.nome} — ${acquistabile.partner}` : 'Il primo premio',
    fase: dati.stato.faseRaggiunta,
    nomeFase: successiva?.nome ?? '',
    bonus: successiva?.bonusGemme ?? 0,
  };
}

/**
 * The queue for this instant. Silence is applied before anything is built, the
 * cap of three is applied at the end, and ids are unique per day so the same
 * thing is never said twice.
 */
export function notifiche(dati: DatiPersistiti, adesso: Date = new Date()): Notifica[] {
  const giorno = dati.giornoCorrente;
  const fase = faseCorrente(dati);
  const ora = adesso.getHours() + adesso.getMinutes() / 60;
  const coda: Notifica[] = [];

  const aggiungi = (tipo: TipoNotifica, chiave: string, ctx: Contesto) => {
    const id = `${giorno.data}:${chiave}`;
    coda.push({ id, tipo, testo: scegli(id, COPY[tipo], ctx), orario: oraTesto(adesso) });
  };

  // --- Messages about yesterday. They survive silence: they are the point of it.
  const ieri = dati.storico[dati.storico.length - 1];
  if (ieri && ora < 12) {
    const ctx = contesto(dati, []);
    if (ieri.tipoGiorno === 'recupero') aggiungi('ripresa-dopo-recupero', 'ripresa', ctx);
    else if (ieri.streakGiorni === 0 && !ieri.checklistCompleta)
      aggiungi('streak-perso', 'streak-perso', ctx);
  }

  // --- Achievements. Not reminders, so a full checklist does not mute them.
  if (dati.stato.avanzamentoDisponibile) {
    aggiungi('level-up', 'level-up', contesto(dati, []));
  }

  const muto = silenzio(dati, adesso);
  if (muto) return limita(coda);

  // --- Absence: from the third day the app stops asking for performance.
  const assenza = giorniDiAssenza(dati);
  if (assenza >= 3) {
    aggiungi('assenza', 'assenza', contesto(dati, []));
    return limita(coda);
  }

  // --- What is actually still missing today.
  const eserciziFatti = fase.esercizi.every((e) => giorno.eserciziFatti.includes(e.id));
  const farmaciFatti = fase.farmaci.every((f) =>
    f.orario.every((o) => giorno.dosiPrese.includes(`${f.id}@${o}`)),
  );
  const mancanti = [
    ...(eserciziFatti ? [] : ['gli esercizi']),
    ...(farmaciFatti ? [] : ['i farmaci']),
    ...(giorno.diario ? [] : ['il diario']),
  ];
  const ctx = contesto(dati, mancanti);

  // A single lighter message on the second day of absence (README §7.2).
  if (assenza === 2) {
    aggiungi('assenza', 'assenza-leggera', ctx);
    return limita(coda);
  }

  // Drug reminders, at the times the plan prescribes. Only the most recent dose
  // due is mentioned: two nags about the same drug in one evening is "twice for
  // the same activity", which README §7.1 rules out.
  const doseDaRicordare = fase.farmaci
    .flatMap((f) => f.orario.map((orario) => ({ f, orario, scadenza: Number(orario.slice(0, 2)) })))
    .filter((d) => ora >= d.scadenza && !giorno.dosiPrese.includes(`${d.f.id}@${d.orario}`))
    .sort((a, b) => b.scadenza - a.scadenza)[0];
  if (doseDaRicordare) {
    aggiungi(
      doseDaRicordare.scadenza >= 14 ? 'farmaci-sera' : 'farmaci',
      `farmaci-${doseDaRicordare.orario}`,
      ctx,
    );
  }

  // Exercises, from mid-afternoon.
  if (!eserciziFatti && ora >= 16) aggiungi('esercizi', 'esercizi', ctx);

  // 20:30: the closing message, with the real numbers inside it.
  if (ora >= 20.5 && mancanti.length > 0) {
    aggiungi(mancanti.length === 1 ? 'manca-poco' : 'chiusura', 'chiusura', ctx);
  }

  // A reward just came within reach.
  if (catalogo(dati).some((r) => r.acquistabile)) aggiungi('sblocco', 'sblocco', ctx);

  return limita(coda);
}

/**
 * What survives the cap, in order. This matters more than it looks: with three
 * slots, the 20:30 closing message — the one carrying the real numbers, and the
 * one most likely to bring someone back — was being pushed out by routine
 * reminders. The cap decides how many; this decides which.
 */
const PRIORITA: TipoNotifica[] = [
  'ripresa-dopo-recupero',
  'streak-perso',
  'level-up',
  'manca-poco',
  'chiusura',
  'assenza',
  'esercizi',
  'farmaci-sera',
  'farmaci',
  'sblocco',
];

/** Dedupe by id, sort by importance, then the hard cap of three (README §7.1). */
function limita(coda: Notifica[]): Notifica[] {
  const viste = new Set<string>();
  return coda
    .filter((n) => !viste.has(n.id) && viste.add(n.id))
    .sort((a, b) => PRIORITA.indexOf(a.tipo) - PRIORITA.indexOf(b.tipo))
    .slice(0, TETTO_GIORNALIERO);
}

function oraTesto(adesso: Date): string {
  return adesso.toTimeString().slice(0, 5);
}

/** "gli esercizi, i farmaci e il diario" — a list a person would say out loud. */
function elenca(voci: string[]): string {
  if (voci.length === 0) return 'niente';
  if (voci.length === 1) return voci[0]!;
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]!}`;
}

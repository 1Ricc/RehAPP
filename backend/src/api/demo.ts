/**
 * Demo controls (TODO-backend.md §9).
 *
 * These exist for one reason: a rehab programme runs for three months and the
 * pitch lasts ten minutes. Without `next-day` nothing that was built can be
 * shown moving.
 *
 * They are not hidden behind a flag. There is no auth, one hardcoded user and a
 * laptop on a hotel wifi — a flag would be theatre, and on Saturday at 13:50 the
 * one thing that must not happen is a control that refuses to work.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';

import { avanzaFase, chiudiGiornata, faseCorrente, moltiplicatore } from '../domain/scoring.js';
import { PROFILI, creaProfilo, type NomeProfilo } from '../data/seed/profili.js';
import { save } from '../data/store.js';
import { richiestaNonValida } from './errori.js';
import { aggiorna } from './servizio.js';
import { sid } from './sessione.js';
import { componiStato } from './vista.js';
import type { DatiPersistiti } from '../domain/types.js';

export const rotteDemo = Router();

function rotta(gestore: (req: Request) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    gestore(req)
      .then((risposta) => res.json(risposta))
      .catch(next);
  };
}

/**
 * POST /api/demo/next-day — closes today and opens tomorrow.
 *
 * By default it ticks the whole checklist first, so pressing the button over
 * and over walks the streak up and shows the phases going by. Pass
 * `{ completa: false }` to close an empty day instead and show a lost streak,
 * which is the other half of the story.
 */
rotteDemo.post(
  '/next-day',
  rotta(async (req) => {
    const completa = (req.body as { completa?: unknown } | undefined)?.completa !== false;
    return componiStato(
      await aggiorna(sid(req), (dati) => {
        const pieno = completa ? riempiChecklist(dati) : dati;
        // Closing is the engine's job; the rollover in servizio.ts then opens
        // tomorrow. Advancing a day means moving the day the state calls today.
        return chiudiEAvanza(pieno);
      }),
    );
  }),
);

/** POST /api/demo/load/:profilo — swaps in one of the three prepared states. */
rotteDemo.post(
  '/load/:profilo',
  rotta(async (req) => {
    const nome = req.params['profilo'] as NomeProfilo;
    if (!(nome in PROFILI)) {
      throw richiestaNonValida(
        `Profilo "${nome}" inesistente. Disponibili: ${Object.keys(PROFILI).join(', ')}.`,
      );
    }
    return componiStato(await save(sid(req), creaProfilo(nome)));
  }),
);

/** POST /api/demo/reset — back to the first-access state. */
rotteDemo.post(
  '/reset',
  rotta(async (req) => componiStato(await save(sid(req), creaProfilo('nuovo')))),
);

/**
 * POST /api/demo/set — `{ streak?, gemme?, rpProgressoFase? }`.
 *
 * The safety net. If something goes wrong ten minutes before the demo, this
 * puts the numbers back where the script expects them. The multiplier is
 * recomputed from the streak rather than being settable, so this cannot create
 * a state the engine would never produce.
 */
rotteDemo.post(
  '/set',
  rotta(async (req) => {
    const { streak, gemme, rpProgressoFase } = (req.body ?? {}) as Record<string, unknown>;
    const numero = (v: unknown, nome: string): number | undefined => {
      if (v === undefined) return undefined;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw richiestaNonValida(`"${nome}" deve essere un numero maggiore o uguale a zero.`);
      }
      return v;
    };
    const s = numero(streak, 'streak');
    const g = numero(gemme, 'gemme');
    const rp = numero(rpProgressoFase, 'rpProgressoFase');
    if (s === undefined && g === undefined && rp === undefined) {
      throw richiestaNonValida('Serve almeno uno fra streak, gemme e rpProgressoFase.');
    }

    return componiStato(
      await aggiorna(sid(req), (dati) => {
        const stato = { ...dati.stato };
        if (s !== undefined) {
          stato.streakGiorni = Math.floor(s);
          stato.moltiplicatoreAttuale = moltiplicatore(stato.streakGiorni);
        }
        if (g !== undefined) stato.gemmePortafoglio = g;
        if (rp !== undefined) {
          stato.rpProgressoFase = rp;
          stato.avanzamentoDisponibile = rp >= stato.sogliaFaseAttuale;
        }
        return { ...dati, stato };
      }),
    );
  }),
);

/** GET /api/demo/profiles — the list, so a demo UI can build its own buttons. */
rotteDemo.get(
  '/profiles',
  rotta(async () => ({
    profili: Object.entries(PROFILI).map(([id, descrizione]) => ({ id, descrizione })),
  })),
);

function riempiChecklist(dati: DatiPersistiti): DatiPersistiti {
  const fase = faseCorrente(dati);
  return {
    ...dati,
    giornoCorrente: {
      ...dati.giornoCorrente,
      eserciziFatti: fase.esercizi.map((e) => e.id),
      dosiPrese: fase.farmaci.flatMap((f) => f.orario.map((o) => `${f.id}@${o}`)),
      diario: dati.giornoCorrente.diario ?? { vas: 3, compilatoAlle: '20:30' },
    },
  };
}

/**
 * Closes the day through the engine and auto-confirms the level-up, which in
 * reality waits for the physio. Without the auto-confirm the phase change never
 * shows on screen.
 */
function chiudiEAvanza(dati: DatiPersistiti): DatiPersistiti {
  const chiuso = chiudiGiornata(dati);
  return chiuso.stato.avanzamentoDisponibile ? avanzaFase(chiuso) : chiuso;
}

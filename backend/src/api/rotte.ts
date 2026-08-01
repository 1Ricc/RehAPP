/**
 * The API contract the frontend talks to (TODO-backend.md §5).
 *
 * One rule holds everywhere: **every call that changes something answers with
 * the whole state**, never a diff. The frontend therefore never recomposes
 * anything by hand — it replaces what it has and redraws.
 *
 * Nothing here decides anything either: the routes validate the input, call the
 * pure domain, and shape the answer. Every judgement lives in `src/domain`.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';

import { ErroreNegozio, riscatta } from '../domain/negozio.js';
import { giorniDiAssenza, notifiche, silenzio } from '../domain/notifiche.js';
import { avanzaFase, classificaGiorno, faseCorrente, finalizzaGiornata } from '../domain/scoring.js';
import { RECUPERI_MANUALI_PER_FASE, VAS_SOGLIA_RECUPERO } from '../domain/costanti.js';
import { CREDENZIALI } from '../data/seed/credenziali.js';
import { save } from '../data/store.js';
import type { Diario, EsercizioPianoCreato, FarmacoPianoCreato, IdBlocco, PianoCreato, Voucher } from '../domain/types.js';
import { nonPossibile, richiestaNonValida } from './errori.js';
import { aggiorna, statoCorrente } from './servizio.js';
import {
  componiBadge,
  componiNegozio,
  componiStato,
  componiStorico,
  componiVoucher,
} from './vista.js';

export const rotte = Router();

/**
 * Wraps a handler so both a throw and a rejected promise reach the error
 * middleware. Express 4 forwards synchronous throws on its own but not async
 * ones, and forgetting that is the classic way to hang a request.
 */
function rotta(gestore: (req: Request) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    gestore(req)
      .then((risposta) => res.json(risposta))
      .catch(next);
  };
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

rotte.get(
  '/state',
  rotta(async () => componiStato(await statoCorrente())),
);

/**
 * POST /api/login — `{ username, password }`.
 *
 * Checked against the hardcoded demo credentials (see `data/seed/credenziali`).
 * Every login re-seeds the shared state from that account's fixed starting
 * point, so the result is always the same regardless of which account logged
 * in before it.
 */
rotte.post(
  '/login',
  rotta(async (req) => {
    const { username, password } = corpo(req) as { username?: unknown; password?: unknown };
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw richiestaNonValida('Servono username e password.');
    }
    const credenziale = CREDENZIALI[username.trim().toLowerCase()];
    if (!credenziale || credenziale.password !== password) {
      throw richiestaNonValida('Credenziali non valide.');
    }
    return componiStato(await save(credenziale.carica()));
  }),
);

/**
 * POST /api/tasks/toggle — `{ blocco, voceId, fatto }`.
 *
 * One item at a time. The RP only land when the whole block is done, but the
 * ticks are stored one by one because that is how a person does them.
 */
rotte.post(
  '/tasks/toggle',
  rotta(async (req) => {
    const { blocco, voceId, fatto } = corpo(req) as {
      blocco?: IdBlocco;
      voceId?: string;
      fatto?: boolean;
    };
    if (blocco !== 'esercizi' && blocco !== 'farmaci') {
      throw richiestaNonValida(
        'Il blocco deve essere "esercizi" o "farmaci". Il diario si compila da /api/diary, perché serve il valore VAS.',
      );
    }
    if (typeof voceId !== 'string' || voceId.length === 0) {
      throw richiestaNonValida('Serve il voceId della voce da spuntare.');
    }
    const acceso = fatto !== false;

    return componiStato(
      await aggiorna((dati) => {
        const fase = faseCorrente(dati);
        const valide =
          blocco === 'esercizi'
            ? fase.esercizi.map((e) => e.id)
            : fase.farmaci.flatMap((f) => f.orario.map((o) => `${f.id}@${o}`));
        if (!valide.includes(voceId)) {
          throw richiestaNonValida(
            `La voce "${voceId}" non è prevista dal piano di oggi (fase ${fase.numero}).`,
          );
        }
        const campo = blocco === 'esercizi' ? 'eserciziFatti' : 'dosiPrese';
        const attuali = dati.giornoCorrente[campo];
        const nuovi = acceso
          ? attuali.includes(voceId)
            ? attuali
            : [...attuali, voceId]
          : attuali.filter((id) => id !== voceId);
        return { ...dati, giornoCorrente: { ...dati.giornoCorrente, [campo]: nuovi } };
      }),
    );
  }),
);

/**
 * POST /api/diary — `{ vas, nota? }`.
 *
 * The gesture that both gives the physio the data and, from VAS 7 up, protects
 * the streak. Same action, both effects: no separate "pause" button.
 */
rotte.post(
  '/diary',
  rotta(async (req) => {
    const { vas, nota } = corpo(req) as { vas?: unknown; nota?: unknown };
    if (typeof vas !== 'number' || !Number.isInteger(vas) || vas < 0 || vas > 10) {
      throw richiestaNonValida('Il valore VAS deve essere un intero da 0 a 10.');
    }
    if (nota !== undefined && typeof nota !== 'string') {
      throw richiestaNonValida('La nota, se presente, deve essere testo.');
    }

    return componiStato(
      await aggiorna((dati) => {
        const diario: Diario = {
          vas,
          ...(nota ? { nota } : {}),
          compilatoAlle: new Date().toTimeString().slice(0, 5),
        };
        return { ...dati, giornoCorrente: { ...dati.giornoCorrente, diario } };
      }),
    );
  }),
);

/**
 * POST /api/day/recovery — `{ motivo }`.
 *
 * The manual declaration, the only recovery reason on a budget: one per phase,
 * because it is the only one with no clinical trace behind it. Can be declared
 * at any hour — in the morning to stop, or in the evening once it is clear the
 * day is gone.
 */
rotte.post(
  '/day/recovery',
  rotta(async (req) => {
    const { motivo } = corpo(req) as { motivo?: unknown };
    if (typeof motivo !== 'string' || motivo.trim().length === 0) {
      throw richiestaNonValida('Serve un motivo, anche breve.');
    }

    return componiStato(
      await aggiorna((dati) => {
        if (dati.stato.recuperiManualiUsatiInFase >= RECUPERI_MANUALI_PER_FASE) {
          throw nonPossibile(
            'Hai già usato il recupero libero di questa fase. Se il ginocchio fa male, segna il dolore nel diario: da ' +
              `VAS ${VAS_SOGLIA_RECUPERO} in su la giornata si mette in pausa da sola, senza limiti.`,
          );
        }
        return {
          ...dati,
          giornoCorrente: {
            ...dati.giornoCorrente,
            recuperoManuale: {
              motivo: motivo.trim(),
              dichiaratoAlle: new Date().toTimeString().slice(0, 5),
            },
          },
        };
      }),
    );
  }),
);

/**
 * POST /api/day/close — manually finalises today.
 *
 * Runs the full day-close math (streak +1, gems, multiplier) right now and
 * marks the day finalised so the 2am rollover does not re-score it. Requires
 * the checklist to be complete; can only be called once per day.
 */
rotte.post(
  '/day/close',
  rotta(async () =>
    componiStato(
      await aggiorna((dati) => {
        const fase = faseCorrente(dati);
        const classe = classificaGiorno(dati.piano, fase, dati.stato, dati.giornoCorrente);
        if (!classe.checklistCompleta) {
          throw richiestaNonValida('La checklist non è ancora completa.');
        }
        if (dati.giornoCorrente.finalizzato) {
          throw nonPossibile('La giornata è già stata finalizzata.');
        }
        return finalizzaGiornata(dati);
      }),
    ),
  ),
);

/**
 * POST /api/phase/advance — confirms the level-up.
 *
 * In reality the physio signs this off; in the demo the frontend calls it as
 * soon as `avanzamentoDisponibile` turns true, so the moment is visible.
 */
rotte.post(
  '/phase/advance',
  rotta(async () =>
    componiStato(
      await aggiorna((dati) => {
        if (!dati.stato.avanzamentoDisponibile) {
          const mancanti = dati.stato.sogliaFaseAttuale - dati.stato.rpProgressoFase;
          throw nonPossibile(`Mancano ancora ${mancanti} RP alla fine di questa fase.`);
        }
        return avanzaFase(dati);
      }),
    ),
  ),
);

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** GET /api/history?giorni=40 — asked for only when the calendar or the chart opens. */
rotte.get(
  '/history',
  rotta(async (req) => {
    const grezzo = req.query['giorni'];
    const giorni = grezzo === undefined ? 40 : Number(grezzo);
    if (!Number.isInteger(giorni) || giorni < 1 || giorni > 400) {
      throw richiestaNonValida('Il parametro "giorni" deve essere un intero fra 1 e 400.');
    }
    return componiStorico(await statoCorrente(), giorni);
  }),
);

// ---------------------------------------------------------------------------
// Store, badges, notifications
// ---------------------------------------------------------------------------

/** GET /api/badges — derived from the state on every call, never stored. */
rotte.get(
  '/badges',
  rotta(async () => componiBadge(await statoCorrente())),
);

/** GET /api/store — catalogue with `sbloccato` and `acquistabile` already decided. */
rotte.get(
  '/store',
  rotta(async () => componiNegozio(await statoCorrente())),
);

/** GET /api/vouchers — what has been redeemed, newest first. */
rotte.get(
  '/vouchers',
  rotta(async () => componiVoucher(await statoCorrente())),
);

/**
 * POST /api/store/:id/redeem — spends the gems and issues the code.
 *
 * Answers with the whole state plus the fresh voucher, so the screen can show
 * the code without a second call.
 */
rotte.post(
  '/store/:id/redeem',
  rotta(async (req) => {
    const id = req.params['id'] ?? '';
    let emesso: Voucher | undefined;
    const dati = await aggiorna((corrente) => {
      try {
        const dopo = riscatta(corrente, id);
        emesso = dopo.voucher[dopo.voucher.length - 1];
        return dopo;
      } catch (errore) {
        if (errore instanceof ErroreNegozio) throw nonPossibile(errore.message);
        throw errore;
      }
    });
    return { voucher: emesso, stato: componiStato(dati) };
  }),
);

// ---------------------------------------------------------------------------
// User-created plans
// ---------------------------------------------------------------------------

/** GET /api/plans/:shareId — look up a single plan by its share code. */
rotte.get(
  '/plans/:shareId',
  rotta(async (req) => {
    const shareId = (req.params['shareId'] ?? '').trim();
    const dati = await statoCorrente();
    const piano = (dati.pianiCreati ?? []).find((p) => p.shareId === shareId);
    if (!piano) throw richiestaNonValida(`No plan found with code "${shareId}".`);
    return piano;
  }),
);

/** GET /api/plans — all plans the user has built, newest first. */
rotte.get(
  '/plans',
  rotta(async () => {
    const dati = await statoCorrente();
    return { piani: dati.pianiCreati ?? [] };
  }),
);

/**
 * POST /api/plans — saves a new plan.
 *
 * The share ID is generated server-side so it is guaranteed unique within this
 * user's data. The plan is prepended so GET /api/plans always returns newest first.
 */
rotte.post(
  '/plans',
  rotta(async (req) => {
    const body = corpo(req) as {
      label?: unknown;
      giorni?: unknown;
      settimane?: unknown;
      esercizi?: unknown;
      farmaci?: unknown;
    };

    if (!Array.isArray(body.giorni) || body.giorni.length === 0) {
      throw richiestaNonValida('Seleziona almeno un giorno della settimana.');
    }
    if (!Array.isArray(body.esercizi) || body.esercizi.length === 0) {
      throw richiestaNonValida('Seleziona almeno un esercizio.');
    }
    if (typeof body.settimane !== 'number' || body.settimane < 1) {
      throw richiestaNonValida('La durata deve essere almeno 1 settimana.');
    }

    const piano: PianoCreato = {
      id: crypto.randomUUID(),
      shareId: Math.random().toString(36).slice(2, 8),
      label: typeof body.label === 'string' ? body.label.trim() : '',
      creatoIl: new Date().toISOString().slice(0, 10),
      giorni: body.giorni as string[],
      settimane: body.settimane,
      esercizi: body.esercizi as EsercizioPianoCreato[],
      farmaci: Array.isArray(body.farmaci) ? (body.farmaci as FarmacoPianoCreato[]) : [],
    };

    await aggiorna((dati) => ({
      ...dati,
      pianiCreati: [piano, ...(dati.pianiCreati ?? [])],
    }));

    return piano;
  }),
);

/**
 * GET /api/notifications — the queue, computed server-side.
 *
 * Also reports *why* it is quiet when it is: the silence rules are the designed
 * part, and showing them is what makes the point on stage.
 */
rotte.get(
  '/notifications',
  rotta(async () => {
    const dati = await statoCorrente();
    return {
      coda: notifiche(dati),
      silenzio: silenzio(dati, new Date()),
      giorniDiAssenza: giorniDiAssenza(dati),
    };
  }),
);

function corpo(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

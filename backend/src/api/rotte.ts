/**
 * The API contract the frontend talks to (TODO-backend.md §5).
 *
 * One rule holds everywhere: **every call that changes something answers with
 * the whole state**, never a diff. The frontend therefore never recomposes
 * anything by hand — it replaces what it has and redraws.
 *
 * Routes belonging to blocks not yet built (store, vouchers, badges,
 * notifications) answer 501 with a readable message instead of 404: whoever
 * builds the frontend gets told it is coming, not that they typed the URL wrong.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';

import { avanzaFase, faseCorrente } from '../domain/scoring.js';
import { RECUPERI_MANUALI_PER_FASE, VAS_SOGLIA_RECUPERO } from '../domain/costanti.js';
import type { Diario, IdBlocco } from '../domain/types.js';
import { nonAncoraPronto, nonPossibile, richiestaNonValida } from './errori.js';
import { aggiorna, statoCorrente } from './servizio.js';
import { componiStato, componiStorico } from './vista.js';

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
// Blocks not built yet — declared so the frontend knows the names
// ---------------------------------------------------------------------------

const inArrivo: [string, string][] = [
  ['/store', 'Il catalogo del negozio arriva col blocco 6.'],
  ['/vouchers', 'I voucher arrivano col blocco 6.'],
  ['/badges', 'I badge arrivano col blocco 7.'],
  ['/notifications', 'Le notifiche arrivano col blocco 8.'],
];
for (const [percorso, messaggio] of inArrivo) {
  rotte.get(percorso, () => {
    throw nonAncoraPronto(messaggio);
  });
}
rotte.post('/store/:id/redeem', () => {
  throw nonAncoraPronto('Il riscatto delle ricompense arriva col blocco 6.');
});

function corpo(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

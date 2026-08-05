/**
 * Registration and login.
 *
 * Both answer with `{ token, utente, stato }`: the client stores the token as
 * its session header and renders the state without a second round trip, which
 * is the same full-state contract every other mutating route follows.
 *
 * These routes are mounted *before* the demo ones, so `/api/login` lands here
 * first. When it cannot serve the request — no database, or credentials that
 * are not an account — it calls `next()` and the hardcoded demo login in
 * `rotte.ts` gets its turn. That is what keeps `demo` / `rehub123` working on a
 * laptop with nothing configured, which is still how the app is shown.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';

import { load } from '../data/store.js';
import {
  AccountNonDisponibili,
  UsernameOccupato,
  accountDisponibili,
  autentica,
  dimentica,
  registra,
} from '../data/utenti.js';
import { ErroreApi, richiestaNonValida } from './errori.js';
import { componiStato } from './vista.js';

export const rotteAuth = Router();

/** Sentinel: this handler declines the request, let the next route try. */
const PASSA = Symbol('passa');

function rotta(gestore: (req: Request) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    gestore(req)
      .then((r) => (r === PASSA ? next() : res.json(r)))
      .catch(next);
  };
}

function testo(v: unknown, campo: string, min = 1): string {
  if (typeof v !== 'string' || v.trim().length < min) {
    throw richiestaNonValida(`"${campo}" deve essere almeno ${min} caratteri.`);
  }
  return v.trim();
}

function corpo(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

rotteAuth.post(
  '/register',
  rotta(async (req) => {
    const dati = corpo(req);
    const username = testo(dati['username'], 'username', 3);
    const password = testo(dati['password'], 'password', 8);
    const nome = testo(dati['nome'], 'nome', 1);
    const eta = dati['eta'] === undefined || dati['eta'] === null ? null : Number(dati['eta']);
    if (eta !== null && (!Number.isInteger(eta) || eta < 1 || eta > 120)) {
      throw richiestaNonValida('L’età deve essere un intero fra 1 e 120.');
    }
    const obiettivo = typeof dati['obiettivo'] === 'string' ? dati['obiettivo'] : '';

    try {
      const sessione = await registra({ username, password, nome, eta, obiettivo });
      const stato = await load(sessione.utente.id);
      return { token: sessione.token, utente: sessione.utente, stato: componiStato(stato) };
    } catch (errore) {
      if (errore instanceof UsernameOccupato) {
        throw new ErroreApi(409, 'username-occupato', errore.message);
      }
      if (errore instanceof AccountNonDisponibili) {
        throw new ErroreApi(503, 'account-non-disponibili', errore.message);
      }
      throw errore;
    }
  }),
);

rotteAuth.post(
  '/login',
  rotta(async (req) => {
    const dati = corpo(req);
    const username = testo(dati['username'], 'username', 1);
    const password = testo(dati['password'], 'password', 1);

    // No database at all: this is a demo-only deployment, so the demo login is
    // the only login there is.
    if (!accountDisponibili()) return PASSA;

    const sessione = await autentica(username, password);
    // Not an account either — it may still be the demo account, and saying
    // "credenziali non valide" here would take the demo down with it.
    if (!sessione) return PASSA;

    const stato = await load(sessione.utente.id);
    return { token: sessione.token, utente: sessione.utente, stato: componiStato(stato) };
  }),
);

rotteAuth.post(
  '/logout',
  rotta(async (req) => {
    const token = req.header('X-Rehub-Session');
    if (token) await dimentica(token);
    return { ok: true };
  }),
);

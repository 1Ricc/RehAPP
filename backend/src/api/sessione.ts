/**
 * Which save file a request belongs to.
 *
 * The client generates an id once and keeps it in `localStorage`, then sends it
 * on every call. A header rather than a cookie: no `SameSite`, no `Secure`, no
 * proxy stripping it, no consent banner — and the client already routes every
 * request through one `fetch` wrapper, so there is exactly one place to add it.
 *
 * The same header carries two different things, told apart by the `t-` prefix:
 *
 *  - a guest id the client made up. **Not authentication**: it is the key to a
 *    demo save file, and whoever guesses another one sees that demo. What it
 *    prevents is two people on one public URL overwriting each other.
 *  - a login token the server issued. That *is* authentication — it is random,
 *    unguessable, and revoked on logout — and it resolves to an account whose
 *    state is keyed by user id.
 *
 * A bearer token, not a signed one: there is nothing to verify offline, the
 * server looks it up. Which means it must never be logged.
 */

import type { NextFunction, Request, Response } from 'express';

import { utenteDaToken, type Utente } from '../data/utenti.js';

export const INTESTAZIONE = 'X-Rehub-Session';

/**
 * Everything without a usable header shares one save file.
 *
 * That keeps curl, the demo script and anything else that has never heard of
 * sessions working exactly as before, instead of handing each bare request a
 * brand new empty state it can never get back to.
 */
export const SESSIONE_ANONIMA = 'anonimo';

/**
 * Deliberately wider than a UUID — the client sends `crypto.randomUUID()`, but
 * a readable id is worth a lot when debugging by hand on demo day. Bounded and
 * alphanumeric is all the property that matters: this string is a primary key,
 * and an unvalidated one is how a bad client fills the table with junk rows.
 *
 * 120 rather than 64 since the same header also carries a login token: `t-`
 * plus 48 hex characters.
 */
const FORMATO = /^[A-Za-z0-9_-]{8,120}$/;

interface RichiestaConSessione extends Request {
  sessione?: string;
  utente?: Utente | null;
}

/**
 * The header now carries one of two things: a guest save-file id, exactly as
 * before, or a `t-…` login token. Resolving a token costs a database round
 * trip, which is why this is async.
 */
export async function sessione(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const grezzo = req.header(INTESTAZIONE);
  const valido = typeof grezzo === 'string' && FORMATO.test(grezzo);
  const r = req as RichiestaConSessione;

  if (valido && grezzo.startsWith('t-')) {
    const utente = await utenteDaToken(grezzo);
    // An expired or forged token falls back to a guest save file rather than a
    // 401: the app stays usable, it just is not your account any more.
    r.utente = utente;
    r.sessione = utente ? utente.id : SESSIONE_ANONIMA;
  } else {
    r.utente = null;
    r.sessione = valido ? grezzo : SESSIONE_ANONIMA;
  }
  next();
}

/** The logged-in user for this request, or null for a guest. */
export function utenteCorrente(req: Request): Utente | null {
  return (req as RichiestaConSessione).utente ?? null;
}

/** The session for this request. Falls back for anything that skipped the middleware. */
export function sid(req: Request): string {
  return (req as RichiestaConSessione).sessione ?? SESSIONE_ANONIMA;
}

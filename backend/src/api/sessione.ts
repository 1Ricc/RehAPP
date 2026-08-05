/**
 * Which save file a request belongs to.
 *
 * The client generates an id once and keeps it in `localStorage`, then sends it
 * on every call. A header rather than a cookie: no `SameSite`, no `Secure`, no
 * proxy stripping it, no consent banner — and the client already routes every
 * request through one `fetch` wrapper, so there is exactly one place to add it.
 *
 * **This is not authentication.** It is the key to a demo save file. Someone who
 * guesses another id sees that demo; the thing it prevents is two people on one
 * public URL overwriting each other, which is a different problem from keeping
 * secrets and the only one this app has.
 */

import type { NextFunction, Request, Response } from 'express';

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
 */
const FORMATO = /^[A-Za-z0-9_-]{8,64}$/;

interface RichiestaConSessione extends Request {
  sessione?: string;
}

export function sessione(req: Request, _res: Response, next: NextFunction): void {
  const grezzo = req.header(INTESTAZIONE);
  (req as RichiestaConSessione).sessione =
    typeof grezzo === 'string' && FORMATO.test(grezzo) ? grezzo : SESSIONE_ANONIMA;
  next();
}

/** The session for this request. Falls back for anything that skipped the middleware. */
export function sid(req: Request): string {
  return (req as RichiestaConSessione).sessione ?? SESSIONE_ANONIMA;
}

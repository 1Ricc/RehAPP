/**
 * Rehub backend. One monolith, one hardcoded user, no auth: the brief allows it
 * and 24 hours do not.
 */

import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { rotteAuth } from './api/auth.js';
import { rotteDemo } from './api/demo.js';
import { ErroreApi } from './api/errori.js';
import { rotte } from './api/rotte.js';
import { sessione } from './api/sessione.js';
import { apri, descrizioneStato } from './data/store.js';
import { accountDisponibili, preparaTabelle } from './data/utenti.js';
import type { RispostaErrore } from './domain/types.js';

const PORTA = Number(process.env['PORT'] ?? 3001);
const HOST = '0.0.0.0';

const app = express();

// Open CORS: the demo is a phone on the same wifi hitting the laptop's IP.
app.use(cors());
app.use(express.json());
// Before the routers: every one of them needs to know whose save file this is.
// Async since resolving a login token is a database lookup, and an async
// middleware's rejection has to be handed to next() by hand.
app.use((req, res, next) => {
  sessione(req, res, next).catch(next);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Before `rotte`, so /api/login is offered to real accounts first. It falls
// through to the demo login there when it cannot serve the request.
app.use('/api', rotteAuth);
app.use('/api', rotte);
app.use('/api/demo', rotteDemo);

/**
 * The built frontend, served by the same process that serves the API.
 *
 * One origin means `fetch('/api/...')` in the client works deployed exactly as
 * it works behind the Vite dev proxy, with no base URL to configure and no CORS
 * to get wrong. It also means one thing to deploy and one thing that can be
 * down. Mounted after the API routers, so no static file can ever shadow a
 * route.
 *
 * Absent in development: `npm run dev` serves the UI from Vite on 5173, this
 * directory does not exist, and the block is skipped.
 */
const CARTELLA_STATICA =
  process.env['REHUB_STATIC_DIR'] ??
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');

if (existsSync(CARTELLA_STATICA)) {
  app.use(express.static(CARTELLA_STATICA));
  // Deep links are client-side routes: anything that is not the API and not a
  // real file is the SPA shell, and the browser sorts out which view it is.
  // Only GET — a POST to a path that does not exist is a mistake, and it should
  // hear about it in JSON below, not receive a page.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(join(CARTELLA_STATICA, 'index.html'));
  });
}

app.use((_req, res) => {
  const errore: RispostaErrore = {
    errore: 'non-trovato',
    messaggio: 'Questa rotta non esiste.',
  };
  res.status(404).json(errore);
});

// Readable errors, never a stack trace on the wire.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErroreApi) {
    const errore: RispostaErrore = { errore: err.codice, messaggio: err.message };
    res.status(err.stato).json(errore);
    return;
  }
  // Malformed JSON is the client's mistake, not a server bug. Left to the
  // branch below it answers 500, which sends whoever is building the frontend
  // hunting through server logs for a typo in their own fetch().
  if (err instanceof SyntaxError && 'body' in err) {
    const errore: RispostaErrore = {
      errore: 'json-non-valido',
      messaggio: 'Il corpo della richiesta non è JSON valido.',
    };
    res.status(400).json(errore);
    return;
  }
  // Anything else is a bug: it goes to the console in full, to the client short.
  console.error('[api]', err);
  const errore: RispostaErrore = {
    errore: 'errore-interno',
    messaggio: 'Qualcosa è andato storto lato server.',
  };
  res.status(500).json(errore);
});

// Open the database before accepting traffic. There is no global state left to
// seed — each session seeds its own on first sight — but the schema upgrade and
// the file permissions are worth finding out about at boot, not mid-request.
await apri();
// Accounts only exist where there is a database to keep them in.
if (accountDisponibili()) await preparaTabelle();

// Hoisted: the listen callback is not async, and the description costs a round
// trip to whichever backend answered.
const descrizione = await descrizioneStato();

app.listen(PORTA, HOST, () => {
  console.log(`Rehub backend su http://localhost:${PORTA}`);
  for (const ip of indirizziLan()) {
    console.log(`  dal telefono:   http://${ip}:${PORTA}`);
  }
  console.log(`  stato:          ${descrizione}`);
  console.log(
    existsSync(CARTELLA_STATICA)
      ? `  frontend:       ${CARTELLA_STATICA}`
      : '  frontend:       non compilato — solo API (in sviluppo usa Vite su 5173)',
  );
});

/** The IP to point the phone at (TODO-backend.md §10). */
function indirizziLan(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((interfacce) => interfacce ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

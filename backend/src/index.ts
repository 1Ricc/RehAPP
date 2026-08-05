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
//
// Deliberately fatal. A configured database that cannot be opened is a broken
// deployment, and serving requests anyway would mean every one of them failing
// somewhere less legible than this.
try {
  await apri();
  // Accounts only exist where there is a database to keep them in.
  if (accountDisponibili()) await preparaTabelle();
} catch (errore) {
  console.error(diagnosiAvvio(errore));
  process.exit(1);
}

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

/**
 * Why the database would not open, in words.
 *
 * The raw `pg` failure is a stack trace and a five-character SQLSTATE, which
 * says nothing about the one thing that is actually wrong: the value of an
 * environment variable on a host somebody configured by hand. This says which
 * host was dialled, as which user, and what to go and look at.
 *
 * **Never prints the password**, which is why the URL is taken apart rather
 * than logged.
 */
function diagnosiAvvio(errore: unknown): string {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    return `\n[avvio] Impossibile aprire il database locale.\n\n${String(errore)}\n`;
  }

  let dove = '(DATABASE_URL non è un URL valido)';
  try {
    const u = new URL(url);
    dove = `  host:     ${u.hostname}\n  utente:   ${decodeURIComponent(u.username)}\n  database: ${u.pathname.replace(/^\//, '')}`;
  } catch {
    /* keep the placeholder: a malformed URL is itself the answer */
  }

  const codice = (errore as { code?: string }).code ?? '';
  const causa: Record<string, string> = {
    '28P01':
      'La password è stata rifiutata.\n\n' +
      'Ricontrolla il valore di DATABASE_URL sull’host: deve essere la stringa\n' +
      'intera, senza apici e senza "export" davanti. Attenzione: il ruolo\n' +
      'predefinito di Neon si chiama `neondb_owner` in ogni progetto, quindi una\n' +
      'stringa copiata da un altro progetto fallisce esattamente così.',
    '28000': 'Autorizzazione rifiutata: utente o regole di accesso non validi.',
    '3D000': 'Il database indicato in fondo all’URL non esiste.',
    ENOTFOUND: 'Host irraggiungibile: il nome non si risolve. Un refuso nell’hostname?',
    EAI_AGAIN: 'Host irraggiungibile: DNS non risponde.',
    ECONNREFUSED: 'Connessione rifiutata: nessuno in ascolto su quella porta.',
    ETIMEDOUT:
      'Timeout in connessione. Su Neon questo è il sintomo classico della stringa\n' +
      'diretta al posto di quella *pooled* (hostname con "-pooler").',
  };

  return [
    '',
    '[avvio] DATABASE_URL è impostata ma il database non si apre.',
    '',
    dove,
    `  codice:   ${codice || '(assente)'}`,
    '',
    causa[codice] ?? String((errore as Error).message ?? errore),
    '',
  ].join('\n');
}

/** The IP to point the phone at (TODO-backend.md §10). */
function indirizziLan(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((interfacce) => interfacce ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

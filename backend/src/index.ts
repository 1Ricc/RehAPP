/**
 * Rehapp backend. One monolith, one hardcoded user, no auth: the brief allows it
 * and 24 hours do not.
 */

import { networkInterfaces } from 'node:os';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { ErroreApi } from './api/errori.js';
import { rotte } from './api/rotte.js';
import { load, percorsoStato } from './data/store.js';
import type { RispostaErrore } from './domain/types.js';

const PORTA = Number(process.env['PORT'] ?? 3001);
const HOST = '0.0.0.0';

const app = express();

// Open CORS: the demo is a phone on the same wifi hitting the laptop's IP.
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', rotte);

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
  // Anything else is a bug: it goes to the console in full, to the client short.
  console.error('[api]', err);
  const errore: RispostaErrore = {
    errore: 'errore-interno',
    messaggio: 'Qualcosa è andato storto lato server.',
  };
  res.status(500).json(errore);
});

// Seed the state file before accepting traffic, so the first request is not the
// one that pays for it.
await load();

app.listen(PORTA, HOST, () => {
  console.log(`Rehapp backend su http://localhost:${PORTA}`);
  for (const ip of indirizziLan()) {
    console.log(`  dal telefono:   http://${ip}:${PORTA}`);
  }
  console.log(`  stato:          ${percorsoStato()}`);
});

/** The IP to point the phone at (TODO-backend.md §10). */
function indirizziLan(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((interfacce) => interfacce ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

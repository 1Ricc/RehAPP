/**
 * Accounts and bearer tokens.
 *
 * The state row for an account is keyed by the user id (`u-<uuid>`), and the
 * token is a separate random string that maps to it. Keying state by the token
 * would mean a logout orphans the progress; keying it by the user id means the
 * token can be thrown away and reissued freely.
 *
 * Accounts require Postgres. Without DATABASE_URL the app is exactly what it
 * was before — anonymous save files — and every function here says so rather
 * than pretending to work.
 */

import { randomBytes, randomUUID } from 'node:crypto';

import { hashPassword, verificaPassword } from '../domain/password.js';
import { pool } from './deposito-postgres.js';

export class UsernameOccupato extends Error {}
export class AccountNonDisponibili extends Error {}

export interface Utente {
  id: string;
  username: string;
  nome: string;
  eta: number | null;
  obiettivo: string;
}

export interface Sessione {
  token: string;
  utente: Utente;
}

/** True when this process can hold accounts at all. */
export function accountDisponibili(): boolean {
  return Boolean(process.env['DATABASE_URL']);
}

function disponibili(): void {
  if (!accountDisponibili()) {
    throw new AccountNonDisponibili(
      'Gli account richiedono un database. Senza DATABASE_URL l’app funziona solo come demo anonima.',
    );
  }
}

export async function preparaTabelle(): Promise<void> {
  disponibili();
  await pool().query(`
    CREATE TABLE IF NOT EXISTS utenti (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nome          TEXT NOT NULL,
      eta           INTEGER,
      obiettivo     TEXT NOT NULL DEFAULT '',
      creato_il     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool().query(`
    CREATE TABLE IF NOT EXISTS sessioni (
      token     TEXT PRIMARY KEY,
      utente_id TEXT NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function registra(dati: {
  username: string;
  password: string;
  nome: string;
  eta: number | null;
  obiettivo: string;
}): Promise<Sessione> {
  disponibili();
  // Stored lowercase, so "Ada" and "ada" are the same person and the UNIQUE
  // index is the thing enforcing it, not a SELECT that races.
  const username = dati.username.trim().toLowerCase();
  const id = `u-${randomUUID()}`;
  const hash = await hashPassword(dati.password);

  try {
    await pool().query(
      `INSERT INTO utenti (id, username, password_hash, nome, eta, obiettivo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, username, hash, dati.nome.trim(), dati.eta, dati.obiettivo.trim()],
    );
  } catch (errore) {
    if ((errore as { code?: string }).code === '23505') {
      throw new UsernameOccupato('Questo username è già preso.');
    }
    throw errore;
  }

  const utente: Utente = {
    id,
    username,
    nome: dati.nome.trim(),
    eta: dati.eta,
    obiettivo: dati.obiettivo.trim(),
  };
  return { token: await emettiToken(id), utente };
}

/** Null on any failure: an unknown username and a wrong password read the same. */
export async function autentica(username: string, password: string): Promise<Sessione | null> {
  disponibili();
  const { rows } = await pool().query<{
    id: string;
    username: string;
    password_hash: string;
    nome: string;
    eta: number | null;
    obiettivo: string;
  }>('SELECT * FROM utenti WHERE username = $1', [username.trim().toLowerCase()]);

  const riga = rows[0];
  if (!riga) return null;
  if (!(await verificaPassword(password, riga.password_hash))) return null;

  const utente: Utente = {
    id: riga.id,
    username: riga.username,
    nome: riga.nome,
    eta: riga.eta,
    obiettivo: riga.obiettivo,
  };
  return { token: await emettiToken(riga.id), utente };
}

export async function utenteDaToken(token: string): Promise<Utente | null> {
  if (!accountDisponibili()) return null;
  const { rows } = await pool().query<{
    id: string;
    username: string;
    nome: string;
    eta: number | null;
    obiettivo: string;
  }>(
    `SELECT u.id, u.username, u.nome, u.eta, u.obiettivo
     FROM sessioni s JOIN utenti u ON u.id = s.utente_id
     WHERE s.token = $1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function dimentica(token: string): Promise<void> {
  if (!accountDisponibili()) return;
  await pool().query('DELETE FROM sessioni WHERE token = $1', [token]);
}

/**
 * A fresh token per login. Old ones keep working: logging in on the phone must
 * not sign you out of the laptop.
 */
async function emettiToken(utenteId: string): Promise<string> {
  const token = `t-${randomBytes(24).toString('hex')}`;
  await pool().query('INSERT INTO sessioni (token, utente_id) VALUES ($1, $2)', [token, utenteId]);
  return token;
}

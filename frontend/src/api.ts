import type {
  RispostaStato,
  RispostaStorico,
  RispostaNegozio,
  RispostaBadge,
  RispostaVoucher,
  RispostaPiani,
  PianoCreato,
  EsercizioPianoCreato,
  FarmacoPianoCreato,
  RispostaErrore,
  IdBlocco,
  Voucher,
} from '@backend/domain/types';

const BASE = '/api';

const CHIAVE_SESSIONE = 'rehub-session';

/**
 * Which save file on the server is ours.
 *
 * Generated once per browser and kept in `localStorage`, so a reload lands back
 * on the same demo and two phones on the same public URL never share one. Not a
 * credential — the server treats it as a key, not a login.
 *
 * `localStorage` throws in private-browsing modes and inside some in-app
 * browsers, and an exception here would take down every request in the app, so
 * the fallback keeps the id in memory for the life of the tab instead.
 */
let sessioneInMemoria: string | null = null;

function sessionId(): string {
  try {
    const salvato = localStorage.getItem(CHIAVE_SESSIONE);
    if (salvato) return salvato;
    const nuovo = crypto.randomUUID();
    localStorage.setItem(CHIAVE_SESSIONE, nuovo);
    return nuovo;
  } catch {
    sessioneInMemoria ??= crypto.randomUUID();
    return sessioneInMemoria;
  }
}

/**
 * Replaces the guest id with the token the server issued at login. Same storage
 * key, so every later request picks it up with no other change — the header is
 * one string, and the server tells a token from a guest id by its `t-` prefix.
 */
export function impostaSessione(token: string): void {
  try {
    localStorage.setItem(CHIAVE_SESSIONE, token);
  } catch {
    sessioneInMemoria = token;
  }
}

/** Back to a fresh guest save file. */
export function dimenticaSessione(): void {
  try {
    localStorage.removeItem(CHIAVE_SESSIONE);
  } catch {
    sessioneInMemoria = null;
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Rehub-Session': sessionId(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as RispostaErrore).messaggio ?? 'Errore sconosciuto');
  return data as T;
}

export const getState = (): Promise<RispostaStato> =>
  fetchJSON('/state');

export interface RispostaAuth {
  token: string;
  utente: { id: string; username: string; nome: string; eta: number | null; obiettivo: string };
  stato: RispostaStato;
}

export const registra = (corpo: {
  username: string;
  password: string;
  nome: string;
  eta: number | null;
  obiettivo: string;
}): Promise<RispostaAuth> =>
  fetchJSON('/register', { method: 'POST', body: JSON.stringify(corpo) });

/**
 * Log in, to an account or to the demo.
 *
 * One endpoint, two shapes. The server offers /api/login to real accounts
 * first and falls through to the hardcoded demo credentials, which answer with
 * a bare state and no token. `token` in the response is what tells them apart.
 */
export const accedi = (username: string, password: string): Promise<RispostaAuth | RispostaStato> =>
  fetchJSON('/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const conAccount = (r: RispostaAuth | RispostaStato): r is RispostaAuth =>
  typeof (r as RispostaAuth).token === 'string';

export const esci = (): Promise<{ ok: boolean }> => fetchJSON('/logout', { method: 'POST' });

export const toggleTask = (blocco: IdBlocco, voceId: string, fatto: boolean): Promise<RispostaStato> =>
  fetchJSON('/tasks/toggle', {
    method: 'POST',
    body: JSON.stringify({ blocco, voceId, fatto }),
  });

export const submitDiary = (vas: number, nota?: string): Promise<RispostaStato> =>
  fetchJSON('/diary', {
    method: 'POST',
    body: JSON.stringify({ vas, ...(nota ? { nota } : {}) }),
  });

export const declareRecovery = (motivo: string): Promise<RispostaStato> =>
  fetchJSON('/day/recovery', {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });

export const closeDay = (): Promise<RispostaStato> =>
  fetchJSON('/day/close', { method: 'POST' });

export const advancePhase = (): Promise<RispostaStato> =>
  fetchJSON('/phase/advance', { method: 'POST' });

export const getHistory = (giorni = 400): Promise<RispostaStorico> =>
  fetchJSON(`/history?giorni=${giorni}`);

export const getStore = (): Promise<RispostaNegozio> =>
  fetchJSON('/store');

export const redeemReward = (id: string): Promise<{ voucher: Voucher; stato: RispostaStato }> =>
  fetchJSON(`/store/${id}/redeem`, { method: 'POST' });

export const getBadges = (): Promise<RispostaBadge> =>
  fetchJSON('/badges');

export const getVouchers = (): Promise<RispostaVoucher> =>
  fetchJSON('/vouchers');

export const getPlans = (): Promise<RispostaPiani> =>
  fetchJSON('/plans');

export const lookupPlan = (shareId: string): Promise<PianoCreato> =>
  fetchJSON(`/plans/${encodeURIComponent(shareId)}`);

export const createPlan = (payload: {
  label: string;
  giorni: string[];
  settimane: number;
  esercizi: EsercizioPianoCreato[];
  farmaci: FarmacoPianoCreato[];
}): Promise<PianoCreato> =>
  fetchJSON('/plans', { method: 'POST', body: JSON.stringify(payload) });

export const adottaPiano = (shareId: string): Promise<RispostaStato> =>
  fetchJSON(`/plans/${encodeURIComponent(shareId)}/adopt`, { method: 'POST' });

export type { EsercizioPianoCreato, FarmacoPianoCreato };

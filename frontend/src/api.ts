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

export const login = (username: string, password: string): Promise<RispostaStato> =>
  fetchJSON('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

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

export type { EsercizioPianoCreato, FarmacoPianoCreato };

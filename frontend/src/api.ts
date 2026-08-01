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

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as RispostaErrore).messaggio ?? 'Errore sconosciuto');
  return data as T;
}

export const getState = (): Promise<RispostaStato> =>
  fetchJSON('/state');

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

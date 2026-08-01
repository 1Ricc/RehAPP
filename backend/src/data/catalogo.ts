/**
 * Store catalogue (TODO-backend.md §6).
 *
 * Invented partners, deliberately: a real brand is not quotable in a hackathon
 * demo, and local partners tell the story better — a pharmacy, a rehab pool, a
 * sports shop are the places someone recovering from an ACL actually goes.
 *
 * `faseRichiesta` is the same one-line gate as the in-app benefits: it keeps the
 * store tied to the clinical path instead of being a flat price list. Nobody is
 * offered a gym voucher while they are still on crutches.
 */

export interface VoceCatalogo {
  id: string;
  nome: string;
  partner: string;
  descrizione: string;
  costo: number;
  faseRichiesta: number;
  /** Set on the repeatable item: how much the price grows after each redeem. */
  incrementoPerRiscatto?: number;
}

export const CATALOGO: VoceCatalogo[] = [
  {
    id: 'borraccia',
    nome: 'RehAPP Thermal Bottle',
    partner: 'RehAPP',
    descrizione: 'First reward, reachable in two or three days',
    costo: 60,
    faseRichiesta: 1,
  },
  {
    id: 'farmacia-10',
    nome: '10% Discount',
    partner: 'Central Pharmacy',
    descrizione: 'On all orthopedic and supplement products',
    costo: 200,
    faseRichiesta: 1,
  },
  {
    id: 'aquavita',
    nome: 'Rehab Pool Session',
    partner: 'AquaVita',
    descrizione: 'A pool session, when water-based exercise becomes beneficial',
    costo: 350,
    faseRichiesta: 2,
  },
  {
    id: 'attiva-sport-20',
    nome: '20% Discount',
    partner: 'ActiveSport',
    descrizione: 'Shoes, braces and technical gear',
    costo: 500,
    faseRichiesta: 2,
  },
  {
    id: 'fitlab-10e',
    nome: '€10 Voucher',
    partner: 'FitLab Gym',
    descrizione: 'Top tier: achievable around day 27',
    costo: 1000,
    faseRichiesta: 3,
  },
  {
    /**
     * The sink. Without something repeatable, past day 30 the gems stop meaning
     * anything and the whole second currency goes flat — the open problem in
     * README §11. Each redeem makes the next one cost 50 more.
     */
    id: 'farmacia-5-ripetibile',
    nome: '5% Discount',
    partner: 'Central Pharmacy',
    descrizione: 'Redeemable as many times as you want, at increasing price',
    costo: 150,
    faseRichiesta: 1,
    incrementoPerRiscatto: 50,
  },
];

export function vocePerId(id: string): VoceCatalogo | undefined {
  return CATALOGO.find((v) => v.id === id);
}

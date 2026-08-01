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
    nome: 'Borraccia termica Rehapp',
    partner: 'Rehapp',
    descrizione: 'Il primo premio, raggiungibile in due o tre giorni',
    costo: 60,
    faseRichiesta: 1,
  },
  {
    id: 'farmacia-10',
    nome: 'Sconto 10%',
    partner: 'Farmacia Centrale',
    descrizione: 'Su tutto il reparto ortopedia e integrazione',
    costo: 200,
    faseRichiesta: 1,
  },
  {
    id: 'aquavita',
    nome: 'Ingresso piscina riabilitativa',
    partner: 'AquaVita',
    descrizione: 'Una seduta in vasca, quando il carico in acqua diventa utile',
    costo: 350,
    faseRichiesta: 2,
  },
  {
    id: 'attiva-sport-20',
    nome: 'Sconto 20%',
    partner: 'Attiva Sport',
    descrizione: 'Scarpe, tutori e abbigliamento tecnico',
    costo: 500,
    faseRichiesta: 2,
  },
  {
    id: 'fitlab-10e',
    nome: 'Buono 10€',
    partner: 'Palestra FitLab',
    descrizione: 'Fascia alta: arriva verso il giorno 27',
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
    nome: 'Sconto 5%',
    partner: 'Farmacia Centrale',
    descrizione: 'Riacquistabile quante volte vuoi, a prezzo crescente',
    costo: 150,
    faseRichiesta: 1,
    incrementoPerRiscatto: 50,
  },
];

export function vocePerId(id: string): VoceCatalogo | undefined {
  return CATALOGO.find((v) => v.id === id);
}

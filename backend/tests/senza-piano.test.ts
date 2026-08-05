import { describe, expect, it } from 'vitest';

import { sincronizzaGiornata } from '../src/api/servizio.js';
import { componiStato } from '../src/api/vista.js';
import { datiPerSessione, datiSenzaPiano } from '../src/data/fixture.js';

describe('uno stato senza piano', () => {
  it('si compone senza esplodere', () => {
    const risposta = componiStato(datiSenzaPiano());
    expect(risposta.senzaPiano).toBe(true);
  });

  it('non ha fase né blocchi da spuntare', () => {
    const risposta = componiStato(datiSenzaPiano());
    expect(risposta.oggi.blocchi).toEqual([]);
    expect(risposta.fase).toBeNull();
  });

  it('parte da zero: niente streak ereditato dal fixture di Marco', () => {
    const dati = datiSenzaPiano();
    expect(dati.stato.streakGiorni).toBe(0);
    expect(dati.stato.gemmePortafoglio).toBe(0);
    expect(dati.stato.rpTotali).toBe(0);
  });

  it('un account nasce senza piano, un ospite col fixture della demo', () => {
    expect(datiPerSessione('u-abc').piano).toBeNull();
    expect(datiPerSessione('ospite-qualunque').piano).not.toBeNull();
  });

  it('il giorno dopo scorre a oggi senza passare dal motore', () => {
    const ieri = datiSenzaPiano(new Date('2026-08-04T12:00:00'));
    const dopo = sincronizzaGiornata(ieri, new Date('2026-08-05T12:00:00'));
    expect(dopo.giornoCorrente.data).toBe('2026-08-05');
    // Nothing was prescribed, so nothing was lost: no closed day, no broken streak.
    expect(dopo.storico).toEqual([]);
    expect(dopo.stato.streakGiorni).toBe(0);
  });
});

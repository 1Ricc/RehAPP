/**
 * Tests for the scoring engine (TODO-backend.md §4).
 *
 * Every number checked here comes from README.md and the oracle in CLAUDE.md.
 * If one of these fails, read the oracle before touching the engine: the rule
 * is that the code adapts to the documented number, not the other way round.
 *
 * Only the engine is tested. It is pure — state in, state out — so there is no
 * server to start and no file to write.
 */

import { describe, expect, it } from 'vitest';

import { creaPianoMarco } from '../src/data/seed/piano-marco.js';
import { creaProfilo } from '../src/data/seed/profili.js';
import {
  badge,
  benefitInApp,
  coloreProfilo,
  prossimoBadge,
  prossimoBenefit,
} from '../src/domain/benefit.js';
import { RP_DIARIO, RP_ESERCIZI, RP_FARMACI, VERSIONE_STATO } from '../src/domain/costanti.js';
import {
  ErroreNegozio,
  catalogo,
  generaCodice,
  prossimaRicompensa,
  riscatta,
} from '../src/domain/negozio.js';
import {
  avanzaFase,
  chiudiGiornata,
  classificaGiorno,
  faseCorrente,
  moltiplicatore,
  nuovoGiorno,
  rpDelGiorno,
} from '../src/domain/scoring.js';
import type { DatiPersistiti } from '../src/domain/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INIZIO = '2026-01-01';

/**
 * A clean state. `conPiano` keeps the prescribed rest days, which turn some
 * days into recovery ones — useful in one test, noise in most, so it is off by
 * default.
 */
function statoVuoto(conRiposi = false): DatiPersistiti {
  const piano = creaPianoMarco(INIZIO);
  if (!conRiposi) {
    piano.giorniRiposoPrescritti = [];
    piano.rivalutazioni = [];
  }
  const fase1 = piano.fasi[0]!;
  return {
    versione: VERSIONE_STATO,
    piano,
    storico: [],
    voucher: [],
    giornoCorrente: nuovoGiorno(INIZIO),
    stato: {
      faseRaggiunta: 1,
      sogliaFaseAttuale: fase1.sogliaRp,
      rpProgressoFase: 0,
      rpTotali: 0,
      giorniFaseTrascorsi: 0,
      gemmePortafoglio: 0,
      streakGiorni: 0,
      moltiplicatoreAttuale: 1,
      recuperiManualiUsatiInFase: 0,
      giorniVasAltiConsecutivi: 0,
      avanzamentoDisponibile: false,
      ultimaGiornataChiusa: null,
    },
  };
}

/** Ticks everything the current phase prescribes, plus the diary. */
function pieno(dati: DatiPersistiti, vas = 3): DatiPersistiti {
  const fase = faseCorrente(dati);
  return {
    ...dati,
    giornoCorrente: {
      ...dati.giornoCorrente,
      eserciziFatti: fase.esercizi.map((e) => e.id),
      dosiPrese: fase.farmaci.flatMap((f) => f.orario.map((o) => `${f.id}@${o}`)),
      diario: { vas, compilatoAlle: '20:30' },
    },
  };
}

/** Closes `giorni` full days in a row, auto-confirming any level-up. */
function giorniPieni(dati: DatiPersistiti, giorni: number): DatiPersistiti {
  let corrente = dati;
  for (let i = 0; i < giorni; i++) {
    corrente = chiudiGiornata(pieno(corrente));
    if (corrente.stato.avanzamentoDisponibile) corrente = avanzaFase(corrente);
  }
  return corrente;
}

const ultimo = (dati: DatiPersistiti) => dati.storico[dati.storico.length - 1]!;

// ---------------------------------------------------------------------------

describe('oracolo del piano', () => {
  it('deriva 308 · 462 · 504 · 378 dal piano, senza numeri scritti a mano', () => {
    const fasi = creaPianoMarco(INIZIO).fasi;
    expect(fasi.map((f) => f.sogliaRp)).toEqual([308, 462, 504, 378]);
    expect(fasi.map((f) => f.bonusGemme)).toEqual([62, 92, 101, 76]);
  });

  it('vale 22 RP al giorno con i farmaci e 18 senza', () => {
    const fasi = creaPianoMarco(INIZIO).fasi;
    const giornaliero = fasi.map(
      (f) => RP_ESERCIZI + (f.farmaci.length > 0 ? RP_FARMACI : 0) + RP_DIARIO,
    );
    expect(giornaliero).toEqual([22, 22, 18, 18]);
  });
});

describe('moltiplicatore', () => {
  it('a streak azzerato vale ×1, mai 0.95', () => {
    expect(moltiplicatore(0)).toBe(1);
    expect(moltiplicatore(1)).toBe(1);
  });

  it('cresce di 0.05 al giorno e si ferma a ×5 dall’81°', () => {
    expect(moltiplicatore(7)).toBe(1.3);
    expect(moltiplicatore(40)).toBe(2.95);
    expect(moltiplicatore(80)).toBe(4.95);
    expect(moltiplicatore(81)).toBe(5);
    expect(moltiplicatore(200)).toBe(5);
  });
});

describe('i primi 7 giorni riproducono la tabella del README', () => {
  const dopo7 = giorniPieni(statoVuoto(), 7);

  it('154 RP di fase, 177.1 gemme, ×1.30, streak 7', () => {
    expect(dopo7.stato.rpProgressoFase).toBe(154);
    expect(dopo7.stato.gemmePortafoglio).toBeCloseTo(177.1, 5);
    expect(dopo7.stato.moltiplicatoreAttuale).toBe(1.3);
    expect(dopo7.stato.streakGiorni).toBe(7);
  });

  it('paga 22 RP al giorno, mai moltiplicati', () => {
    expect(dopo7.storico.map((g) => g.rpGuadagnati)).toEqual([22, 22, 22, 22, 22, 22, 22]);
  });
});

describe('giorno di recupero', () => {
  const prima = giorniPieni(statoVuoto(), 7);
  const dopo = chiudiGiornata({
    ...prima,
    giornoCorrente: { ...prima.giornoCorrente, diario: { vas: 8, compilatoAlle: '20:30' } },
  });

  it('lascia lo stato identico tranne la data', () => {
    const { ultimaGiornataChiusa: _a, giorniVasAltiConsecutivi: _b, ...restoDopo } = dopo.stato;
    const { ultimaGiornataChiusa: _c, giorniVasAltiConsecutivi: _d, ...restoPrima } = prima.stato;
    expect(restoDopo).toEqual(restoPrima);
  });

  it('non paga niente e non consuma il giorno di fase', () => {
    expect(ultimo(dopo).rpGuadagnati).toBe(0);
    expect(ultimo(dopo).gemmeGuadagnate).toBe(0);
    expect(dopo.stato.giorniFaseTrascorsi).toBe(prima.stato.giorniFaseTrascorsi);
  });

  it('congela il moltiplicatore invece di incrementarlo', () => {
    expect(dopo.stato.moltiplicatoreAttuale).toBe(1.3);
    expect(dopo.stato.streakGiorni).toBe(7);
  });

  it('non è farmabile: 4 giorni di freeze non muovono niente', () => {
    let d = prima;
    for (let i = 0; i < 4; i++) {
      d = chiudiGiornata({
        ...d,
        giornoCorrente: { ...d.giornoCorrente, diario: { vas: 9, compilatoAlle: '20:30' } },
      });
    }
    expect(d.stato.gemmePortafoglio).toBe(prima.stato.gemmePortafoglio);
    expect(d.stato.rpProgressoFase).toBe(prima.stato.rpProgressoFase);
    expect(d.stato.moltiplicatoreAttuale).toBe(prima.stato.moltiplicatoreAttuale);
  });
});

describe('tutto o niente per blocco', () => {
  const base = giorniPieni(statoVuoto(), 3);
  const fase = faseCorrente(base);
  const parziale = chiudiGiornata({
    ...base,
    giornoCorrente: {
      ...base.giornoCorrente,
      eserciziFatti: fase.esercizi.slice(0, 2).map((e) => e.id),
      dosiPrese: fase.farmaci.flatMap((f) => f.orario.map((o) => `${f.id}@${o}`)),
      diario: { vas: 2, compilatoAlle: '20:30' },
    },
  });

  it('2 esercizi su 3 valgono 0 RP dal blocco: restano farmaci e diario', () => {
    expect(ultimo(parziale).rpGuadagnati).toBe(RP_FARMACI + RP_DIARIO);
    expect(ultimo(parziale).blocchiCompletati.esercizi).toBe(false);
  });

  it('azzera lo streak e riporta il moltiplicatore a ×1, mai 0.95', () => {
    expect(parziale.stato.streakGiorni).toBe(0);
    expect(parziale.stato.moltiplicatoreAttuale).toBe(1);
  });

  it('non fa arretrare gli RP di fase', () => {
    expect(parziale.stato.rpProgressoFase).toBeGreaterThan(base.stato.rpProgressoFase);
  });
});

describe('avanzamento di fase', () => {
  const aSoglia = (() => {
    let d = statoVuoto();
    for (let i = 0; i < 14; i++) d = chiudiGiornata(pieno(d));
    return d;
  })();

  it('a 308 RP propone il level-up', () => {
    expect(aSoglia.stato.rpProgressoFase).toBe(308);
    expect(aSoglia.stato.avanzamentoDisponibile).toBe(true);
  });

  it('alla conferma passa in fase 2 con +62 gemme e soglia 462', () => {
    const prima = aSoglia.stato.gemmePortafoglio;
    const dopo = avanzaFase(aSoglia);
    expect(dopo.stato.faseRaggiunta).toBe(2);
    expect(dopo.stato.gemmePortafoglio - prima).toBe(62);
    expect(dopo.stato.sogliaFaseAttuale).toBe(462);
    expect(dopo.stato.recuperiManualiUsatiInFase).toBe(0);
  });

  it('non azzera il moltiplicatore: il successo non va penalizzato', () => {
    expect(avanzaFase(aSoglia).stato.moltiplicatoreAttuale).toBe(
      aSoglia.stato.moltiplicatoreAttuale,
    );
  });
});

describe('fase 3, senza farmaci', () => {
  // 14 days of phase 1 + 21 of phase 2 land on the first day of phase 3.
  const inFase3 = giorniPieni(statoVuoto(), 35);

  it('è arrivata in fase 3', () => {
    expect(inFase3.stato.faseRaggiunta).toBe(3);
  });

  it('una giornata piena vale 18 RP, non 22', () => {
    const fase = faseCorrente(inFase3);
    expect(fase.farmaci).toHaveLength(0);
    expect(rpDelGiorno(fase, pieno(inFase3).giornoCorrente, false)).toBe(18);
  });
});

describe('precedenza nella classificazione', () => {
  const base = giorniPieni(statoVuoto(), 3);
  const fase = faseCorrente(base);

  it('checklist piena con VAS 8 → giorno normale, RP pieni', () => {
    const dopo = chiudiGiornata(pieno(base, 8));
    expect(ultimo(dopo).tipoGiorno).toBe('normale');
    expect(ultimo(dopo).rpGuadagnati).toBe(22);
    expect(dopo.stato.streakGiorni).toBe(4);
  });

  it('il riposo prescritto batte la checklist piena', () => {
    const conRiposi = giorniPieni(statoVuoto(true), 3);
    const riposo = conRiposi.piano.giorniRiposoPrescritti[0]!;
    const classe = classificaGiorno(
      conRiposi.piano,
      faseCorrente(conRiposi),
      conRiposi.stato,
      pieno({ ...conRiposi, giornoCorrente: nuovoGiorno(riposo) }).giornoCorrente,
    );
    expect(classe.tipoGiorno).toBe('recupero');
    expect(classe.motivoRecupero).toBe('riposo-prescritto');
    // The checklist is still recorded as done: it is the day that does not count.
    expect(classe.checklistCompleta).toBe(true);
  });

  it('il recupero manuale vale una volta per fase', () => {
    const dichiara = (d: DatiPersistiti) =>
      chiudiGiornata({
        ...d,
        giornoCorrente: {
          ...d.giornoCorrente,
          recuperoManuale: { motivo: 'imprevisto', dichiaratoAlle: '09:00' },
        },
      });
    const primo = dichiara(base);
    expect(ultimo(primo).motivoRecupero).toBe('manuale');
    expect(primo.stato.recuperiManualiUsatiInFase).toBe(1);

    const secondo = dichiara(primo);
    expect(ultimo(secondo).tipoGiorno).toBe('normale');
    expect(secondo.stato.streakGiorni).toBe(0);
  });

  it('il freeze da dolore non ha tetto: l’allerta sale, lo streak resta', () => {
    let d = base;
    for (let i = 0; i < 8; i++) {
      d = chiudiGiornata({
        ...d,
        giornoCorrente: { ...d.giornoCorrente, diario: { vas: 8, compilatoAlle: '20:30' } },
      });
    }
    expect(d.stato.giorniVasAltiConsecutivi).toBe(8);
    expect(d.stato.streakGiorni).toBe(base.stato.streakGiorni);
  });

  it('gli esercizi non spariti dal piano tengono in piedi la checklist', () => {
    // Guard against the loop invariant 7 warns about: a recovery day must never
    // make the checklist look complete by dropping the exercises.
    const soloFarmaciEDiario = {
      ...base.giornoCorrente,
      dosiPrese: fase.farmaci.flatMap((f) => f.orario.map((o) => `${f.id}@${o}`)),
      diario: { vas: 8, compilatoAlle: '20:30' },
    };
    const classe = classificaGiorno(base.piano, fase, base.stato, soloFarmaciEDiario);
    expect(classe.checklistCompleta).toBe(false);
    expect(classe.tipoGiorno).toBe('recupero');
  });
});

describe('84 giorni pieni', () => {
  const fine = giorniPieni(statoVuoto(), 84);

  it('il moltiplicatore si ferma a ×5 dall’81°', () => {
    const molt = fine.storico.map((g) => g.moltiplicatoreApplicato);
    expect(molt[79]).toBe(4.95);
    expect(molt[80]).toBe(5);
    expect(molt[83]).toBe(5);
  });

  it('arriva in fase 4 e non va oltre', () => {
    expect(fine.stato.faseRaggiunta).toBe(4);
  });
});

describe('benefit in-app e badge', () => {
  const adesso = new Date('2026-08-01T12:00:00');

  it('il gating è una sola condizione: faseRaggiunta >= faseRichiesta', () => {
    expect(benefitInApp(1).map((b) => b.sbloccato)).toEqual([false, false]);
    expect(benefitInApp(2).map((b) => b.sbloccato)).toEqual([true, false]);
    expect(benefitInApp(3).map((b) => b.sbloccato)).toEqual([true, true]);
  });

  it('il grafico del dolore si apre in fase 2, il calendario in fase 3', () => {
    expect(prossimoBenefit(1)?.id).toBe('grafico-dolore');
    expect(prossimoBenefit(2)?.id).toBe('calendario-heatmap');
    expect(prossimoBenefit(4)).toBeNull();
  });

  it('il colore del profilo cambia a ogni fase e non esce dai bordi', () => {
    const colori = [1, 2, 3, 4].map((f) => coloreProfilo(f).etichetta);
    expect(new Set(colori).size).toBe(4);
    expect(coloreProfilo(0)).toEqual(coloreProfilo(1));
    expect(coloreProfilo(99)).toEqual(coloreProfilo(4));
  });

  it('a stato vuoto nessun badge è ottenuto', () => {
    const elenco = badge(creaProfilo('nuovo', adesso));
    expect(elenco.filter((b) => b.ottenuto)).toHaveLength(0);
    expect(elenco).toHaveLength(4);
  });

  it('avanzato ha tutti e quattro i badge', () => {
    const elenco = badge(creaProfilo('avanzato', adesso));
    expect(elenco.filter((b) => b.ottenuto).map((b) => b.id)).toEqual([
      'prima-settimana',
      'fase-superata',
      'streak-30',
      'diario-14',
    ]);
    expect(prossimoBadge(elenco)).toBeNull();
  });

  it('premia lo streak massimo raggiunto, non quello di oggi', () => {
    // Seven full days then a lost one: the badge stays, the streak does not.
    const rotto = chiudiGiornata(giorniPieni(statoVuoto(), 7));
    expect(rotto.stato.streakGiorni).toBe(0);
    expect(badge(rotto).find((b) => b.id === 'prima-settimana')?.ottenuto).toBe(true);
  });

  it('propone come prossimo quello più vicino', () => {
    const elenco = badge(giorniPieni(statoVuoto(), 10));
    expect(prossimoBadge(elenco)?.id).toBe('diario-14');
  });
});

describe('negozio e voucher', () => {
  const adesso = new Date('2026-08-01T12:00:00');
  const conGemme = (gemme: number, fase = 1): DatiPersistiti => {
    const d = statoVuoto();
    return { ...d, stato: { ...d.stato, gemmePortafoglio: gemme, faseRaggiunta: fase } };
  };

  it('il codice ha il formato REHAPP-XXXX-XXXX, senza caratteri ambigui', () => {
    const codice = generaCodice();
    expect(codice).toMatch(/^REHAPP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('confronta le gemme arrotondate per difetto, come la barra in alto', () => {
    // 199.6 in cassa: la barra mostra 199, quindi il buono da 200 non si compra.
    const quasi = catalogo(conGemme(199.6)).find((r) => r.id === 'farmacia-10')!;
    expect(quasi.acquistabile).toBe(false);
    expect(quasi.gemmeMancanti).toBe(1);
    expect(catalogo(conGemme(200)).find((r) => r.id === 'farmacia-10')!.acquistabile).toBe(true);
  });

  it('non offre quello che la fase non ha ancora sbloccato', () => {
    const inFase1 = catalogo(conGemme(5000, 1)).find((r) => r.id === 'fitlab-10e')!;
    expect(inFase1.sbloccato).toBe(false);
    expect(inFase1.acquistabile).toBe(false);
    expect(catalogo(conGemme(5000, 3)).find((r) => r.id === 'fitlab-10e')!.acquistabile).toBe(true);
  });

  it('scala le gemme ed emette il voucher', () => {
    const dopo = riscatta(conGemme(300), 'farmacia-10', adesso);
    expect(dopo.stato.gemmePortafoglio).toBe(100);
    expect(dopo.voucher).toHaveLength(1);
    expect(dopo.voucher[0]!.gemmeSpese).toBe(200);
    expect(dopo.voucher[0]!.partner).toBe('Farmacia Centrale');
  });

  it('una ricompensa non ripetibile si prende una volta sola', () => {
    const dopo = riscatta(conGemme(500), 'farmacia-10', adesso);
    expect(() => riscatta(dopo, 'farmacia-10', adesso)).toThrow(ErroreNegozio);
  });

  it('il pozzo ripetibile costa 50 in più a ogni riacquisto', () => {
    let d = conGemme(2000);
    const costi: number[] = [];
    for (let i = 0; i < 4; i++) {
      costi.push(catalogo(d).find((r) => r.id === 'farmacia-5-ripetibile')!.costo);
      d = riscatta(d, 'farmacia-5-ripetibile', adesso);
    }
    expect(costi).toEqual([150, 200, 250, 300]);
    expect(d.stato.gemmePortafoglio).toBe(2000 - 900);
    expect(d.voucher).toHaveLength(4);
  });

  it('rifiuta con un messaggio che dice quante gemme mancano', () => {
    expect(() => riscatta(conGemme(50), 'farmacia-10', adesso)).toThrow(/mancano 150 gemme/i);
  });

  it('propone come prossima la più vicina fra quelle sbloccate', () => {
    const elenco = catalogo(conGemme(100));
    expect(prossimaRicompensa(elenco)?.id).toBe('farmacia-5-ripetibile');
  });
});

describe('profili demo', () => {
  const adesso = new Date('2026-08-01T12:00:00');

  it('nuovo parte da zero', () => {
    const d = creaProfilo('nuovo', adesso);
    expect(d.storico).toHaveLength(0);
    expect(d.stato.rpTotali).toBe(0);
  });

  it('avanzato ha streak 34, ×2.65 e un calendario da guardare', () => {
    const d = creaProfilo('avanzato', adesso);
    expect(d.stato.streakGiorni).toBe(34);
    expect(d.stato.moltiplicatoreAttuale).toBe(2.65);
    expect(d.storico).toHaveLength(40);
    expect(d.storico.filter((g) => g.tipoGiorno === 'recupero').length).toBeGreaterThan(0);
    expect(d.storico.filter((g) => !g.checklistCompleta).length).toBeGreaterThan(0);
  });

  it('soglia è a una giornata piena dal level-up', () => {
    const d = creaProfilo('soglia', adesso);
    const mancanti = d.stato.sogliaFaseAttuale - d.stato.rpProgressoFase;
    expect(mancanti).toBe(22);
    expect(chiudiGiornata(pieno(d)).stato.avanzamentoDisponibile).toBe(true);
  });
});

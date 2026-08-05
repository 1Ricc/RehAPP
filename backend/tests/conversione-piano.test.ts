import { describe, expect, it } from 'vitest';

import { PianoNonConvertibile, convertiPiano } from '../src/domain/conversione-piano.js';
import { RP_DIARIO, RP_ESERCIZI, RP_FARMACI } from '../src/domain/costanti.js';
import type { PianoCreato, Paziente } from '../src/domain/types.js';

const paziente: Paziente = {
  nome: 'Ada',
  eta: 34,
  patologia: 'Custom plan',
  dataIntervento: '2026-08-01',
};

const creato: PianoCreato = {
  id: 'p1',
  shareId: 'abc123',
  label: 'My knee plan',
  creatoIl: '2026-08-01',
  giorni: ['mon', 'wed', 'fri'],
  settimane: 4,
  esercizi: [
    { id: 'kn1', nome: 'Quad Sets', area: 'Knee', serie: 3, ripetizioni: 10, frequenza: 3 },
    { id: 'kn2', nome: 'Heel Slides', area: 'Knee', serie: 2, ripetizioni: 15, frequenza: 7 },
  ],
  farmaci: [{ nome: 'Ibuprofen 400mg', giorni: ['mon', 'wed', 'fri'], orari: ['08:00', '20:00'] }],
};

describe('convertiPiano', () => {
  it('produce quattro fasi', () => {
    expect(convertiPiano(creato, paziente, '2026-08-03').fasi).toHaveLength(4);
  });

  it('ogni esercizio è quotidiano: la frequenza scelta viene ignorata', () => {
    const piano = convertiPiano(creato, paziente, '2026-08-03');
    for (const fase of piano.fasi) {
      for (const esercizio of fase.esercizi) expect(esercizio.frequenzaSettimanale).toBe(7);
    }
  });

  it('i giorni non selezionati diventano riposo prescritto', () => {
    const piano = convertiPiano(creato, paziente, '2026-08-03'); // 2026-08-03 is a Monday
    // Tuesday the 4th is not in mon/wed/fri, Wednesday the 5th is.
    expect(piano.giorniRiposoPrescritti).toContain('2026-08-04');
    expect(piano.giorniRiposoPrescritti).not.toContain('2026-08-05');
  });

  it('la soglia di una fase è i suoi giorni di lavoro per gli RP giornalieri', () => {
    const piano = convertiPiano(creato, paziente, '2026-08-03');
    const giornalieri = RP_ESERCIZI + RP_FARMACI + RP_DIARIO;
    // 4 weeks x 3 working days = 12, split across 4 phases = 3 each.
    expect(piano.fasi[0]?.sogliaRp).toBe(3 * giornalieri);
  });

  it('senza farmaci la giornata vale meno, e la soglia lo riflette', () => {
    const senzaFarmaci = { ...creato, farmaci: [] };
    const piano = convertiPiano(senzaFarmaci, paziente, '2026-08-03');
    expect(piano.fasi[0]?.sogliaRp).toBe(3 * (RP_ESERCIZI + RP_DIARIO));
  });

  it('un piano senza esercizi è rifiutato, non convertito in RP gratis', () => {
    expect(() => convertiPiano({ ...creato, esercizi: [] }, paziente, '2026-08-03')).toThrow(
      PianoNonConvertibile,
    );
  });

  it('un piano senza giorni selezionati è rifiutato', () => {
    expect(() => convertiPiano({ ...creato, giorni: [] }, paziente, '2026-08-03')).toThrow(
      PianoNonConvertibile,
    );
  });
});

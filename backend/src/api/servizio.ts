/**
 * The thin layer between the routes and the pure engine: it loads, closes any
 * day that has gone by, applies a change and saves.
 *
 * The rollover lives here and not in the engine because it is the one thing
 * that needs a clock. Without it, an app opened the next morning would still be
 * showing yesterday's checklist and yesterday would never be scored.
 */

import { load, save } from '../data/store.js';
import { chiudiGiornata, nuovoGiorno } from '../domain/scoring.js';
import { aggiungiGiorni, giornataLogica } from '../domain/tempo.js';
import type { DatiPersistiti } from '../domain/types.js';

/** Backstop against a clock jump turning the rollover into an infinite loop. */
const MAX_GIORNI_RECUPERATI = 400;

/**
 * Closes every day between the open one and today, in order, so each gets
 * scored with the rules that applied to it. A day nobody opened the app on is a
 * lost day, and that is exactly what the engine records for it.
 */
export function sincronizzaGiornata(dati: DatiPersistiti, adesso: Date): DatiPersistiti {
  const oggi = giornataLogica(adesso);
  let corrente = dati;
  let giri = 0;
  while (corrente.giornoCorrente.data < oggi && giri < MAX_GIORNI_RECUPERATI) {
    if (corrente.giornoCorrente.finalizzato) {
      // Already manually finalised; just open the next day without re-scoring.
      corrente = { ...corrente, giornoCorrente: nuovoGiorno(aggiungiGiorni(corrente.giornoCorrente.data, 1)) };
    } else {
      corrente = chiudiGiornata(corrente);
    }
    giri += 1;
  }
  return corrente;
}

/** Reads the state, rolling the day over first. Persists only if something moved. */
export async function statoCorrente(adesso: Date = new Date()): Promise<DatiPersistiti> {
  const dati = await load();
  const sincronizzato = sincronizzaGiornata(dati, adesso);
  if (sincronizzato !== dati) await save(sincronizzato);
  return sincronizzato;
}

/**
 * Applies a change and saves. `muta` is pure: it gets the state and returns a
 * new one, exactly like the engine.
 *
 * **`muta` must stay synchronous**, and that is load-bearing. Read and write
 * happen in one uninterrupted turn — the await resolves, `muta` runs, `save`
 * updates the cache — so two requests arriving together cannot both read the
 * old state and have one overwrite the other. Put an `await` inside `muta` and
 * three quick ticks in a row start losing one, which is exactly the scenario
 * the optimistic UI produces (TODO §5).
 */
export async function aggiorna(
  muta: (dati: DatiPersistiti) => DatiPersistiti,
  adesso: Date = new Date(),
): Promise<DatiPersistiti> {
  return save(muta(await statoCorrente(adesso)));
}

/**
 * Login credentials for the demo.
 *
 * The app has one real patient and one global state (see ARCHITECTURE.md);
 * this is not a multi-tenant login. Both accounts are deterministic on
 * purpose: each login re-seeds the shared state from scratch, so the result
 * never depends on which account logged in last. "marco" reloads the
 * `settimana` profile (phase 1, streak 7 — same numbers as the README's
 * day-7 fixture, but with real `storico` entries so the home screen's mini
 * calendar has real days to colour, not just today); "giulia" reloads the
 * `vetrina` profile (phase 3, long streak, both in-app benefits unlocked)
 * for the pitch. Plaintext, hardcoded passwords are fine here for the same
 * reason there is no auth elsewhere in this app: one laptop, one demo, ten
 * minutes.
 */

import { creaProfilo } from './profili.js';
import type { DatiPersistiti } from '../../domain/types.js';

interface Credenziale {
  password: string;
  carica: () => DatiPersistiti;
}

/** The plan is always Marco's (`piano-marco.ts` hardcodes the name); rename
 * the patient on the way out so the account you logged into is the name you
 * see on screen. */
function conNome(dati: DatiPersistiti, nome: string): DatiPersistiti {
  return { ...dati, piano: { ...dati.piano, paziente: { ...dati.piano.paziente, nome } } };
}

export const CREDENZIALI: Record<string, Credenziale> = {
  marco: { password: 'rehub123', carica: () => creaProfilo('settimana') },
  giulia: { password: 'rehub123', carica: () => conNome(creaProfilo('vetrina'), 'Giulia') },
};

/**
 * Login credentials for the demo.
 *
 * The app has one real patient and one global state (see ARCHITECTURE.md);
 * this is not a multi-tenant login. There is exactly one account, and it is
 * deterministic on purpose: logging in always re-seeds the shared state from
 * the `presentazione` profile, so the result never depends on what the state
 * looked like before. Plaintext, hardcoded password is fine here for the
 * same reason there is no auth elsewhere in this app: one laptop, one demo,
 * ten minutes.
 */

import { creaProfilo } from './profili.js';
import type { DatiPersistiti } from '../../domain/types.js';

interface Credenziale {
  password: string;
  carica: () => DatiPersistiti;
}

export const CREDENZIALI: Record<string, Credenziale> = {
  demo: { password: 'rehub123', carica: () => creaProfilo('presentazione') },
};

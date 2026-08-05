/**
 * Numbers the design fixed. Changing any of these changes the oracle in
 * CLAUDE.md, so they live in one place and are read, never inlined.
 */

/**
 * RP per block. Fixed for the whole programme: an action is worth what it is
 * worth, in every phase. What changes between phases is which blocks exist —
 * from phase 3 there is no drug, so the day is worth 18 instead of 22.
 */
export const RP_ESERCIZI = 16;

/** Every dose of the day, all or nothing (README §5.1). */
export const RP_FARMACI = 4;

/** Filled in every day, even on a perfect knee. */
export const RP_DIARIO = 2;

/** The day ends at 02:00, not at midnight (README §5.1). */
export const ORA_CHIUSURA_GIORNATA = 2;

/** From here up, the diary freezes the day — unless the checklist is full. */
export const VAS_SOGLIA_RECUPERO = 7;

/** Multiplier: `min(1 + PASSO * max(streak - 1, 0), TETTO)`. */
export const MOLTIPLICATORE_BASE = 1;
export const MOLTIPLICATORE_PASSO = 0.05;
export const MOLTIPLICATORE_TETTO = 5;

/** End-of-phase bonus, flat, never multiplied. */
export const BONUS_FINE_FASE = 0.2;

/** The only capped recovery reason: the user's word with no clinical trace. */
export const RECUPERI_MANUALI_PER_FASE = 1;

/** Consecutive high-VAS days that raise the alert. The streak is never touched. */
export const ALLERTA_SENTI_FISIOTERAPISTA = 3;
export const ALLERTA_RIVALUTA_PIANO = 7;

/** Bumped when DatiPersistiti changes shape. v3 made `piano` nullable. */
export const VERSIONE_STATO = 3;

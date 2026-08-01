/**
 * Every failure the API answers with is one of these. The message is written to
 * be shown to a person: readable, in Italian, never a stack trace.
 */
export class ErroreApi extends Error {
  constructor(
    readonly stato: number,
    readonly codice: string,
    messaggio: string,
  ) {
    super(messaggio);
    this.name = 'ErroreApi';
  }
}

export function nonTrovato(messaggio: string): ErroreApi {
  return new ErroreApi(404, 'non-trovato', messaggio);
}

export function richiestaNonValida(messaggio: string): ErroreApi {
  return new ErroreApi(400, 'richiesta-non-valida', messaggio);
}

export function nonPossibile(messaggio: string): ErroreApi {
  return new ErroreApi(409, 'non-possibile', messaggio);
}

/** For the routes whose block has not been built yet. Honest 501 beats a fake payload. */
export function nonAncoraPronto(messaggio: string): ErroreApi {
  return new ErroreApi(501, 'non-implementato', messaggio);
}

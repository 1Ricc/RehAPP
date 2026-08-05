/**
 * Accounts, against a real Postgres. Skips itself offline — see the header of
 * deposito-postgres.test.ts for the throwaway container.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const forse = process.env['DATABASE_URL'] ? describe : describe.skip;

forse('utenti', () => {
  let utenti: typeof import('../src/data/utenti.js');
  let pg: typeof import('../src/data/deposito-postgres.js');
  const nome = () => `test_${crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    utenti = await import('../src/data/utenti.js');
    pg = await import('../src/data/deposito-postgres.js');
    await utenti.preparaTabelle();
  });

  afterAll(async () => {
    await pg.pool().end();
  });

  it('registra e poi autentica', async () => {
    const u = nome();
    const creato = await utenti.registra({
      username: u,
      password: 'segreta1',
      nome: 'Ada',
      eta: 34,
      obiettivo: 'Run again',
    });
    expect(creato.utente.id.startsWith('u-')).toBe(true);
    const sessione = await utenti.autentica(u, 'segreta1');
    expect(sessione?.utente.id).toBe(creato.utente.id);
  });

  it('la password sbagliata non autentica', async () => {
    const u = nome();
    await utenti.registra({ username: u, password: 'segreta1', nome: 'Ada', eta: 34, obiettivo: '' });
    expect(await utenti.autentica(u, 'sbagliata')).toBeNull();
  });

  it('lo username è unico e non distingue le maiuscole', async () => {
    const u = nome();
    await utenti.registra({ username: u, password: 'segreta1', nome: 'Ada', eta: 34, obiettivo: '' });
    await expect(
      utenti.registra({
        username: u.toUpperCase(),
        password: 'altra123',
        nome: 'Bea',
        eta: 20,
        obiettivo: '',
      }),
    ).rejects.toThrow(utenti.UsernameOccupato);
  });

  it('il token risolve all’utente, e dopo il logout non più', async () => {
    const u = nome();
    const { token } = await utenti.registra({
      username: u,
      password: 'segreta1',
      nome: 'Ada',
      eta: 34,
      obiettivo: '',
    });
    expect((await utenti.utenteDaToken(token))?.username).toBe(u.toLowerCase());
    await utenti.dimentica(token);
    expect(await utenti.utenteDaToken(token)).toBeNull();
  });

  it('un token inventato non risolve', async () => {
    expect(await utenti.utenteDaToken('non-esiste-proprio')).toBeNull();
  });
});

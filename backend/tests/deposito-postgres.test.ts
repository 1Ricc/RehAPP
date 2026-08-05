/**
 * The Postgres backend, against a real database.
 *
 * Skips itself when there is no DATABASE_URL, so the suite still runs offline
 * on a laptop with nothing installed. To run it for real, point it at any
 * Postgres — a throwaway container is enough:
 *
 *   docker run -d --name rehub-pg -e POSTGRES_PASSWORD=rehub -e POSTGRES_USER=rehub \
 *     -e POSTGRES_DB=rehub -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL='postgresql://rehub:rehub@localhost:55432/rehub' npm test
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env['DATABASE_URL'];
const forse = URL ? describe : describe.skip;

forse('deposito postgres', () => {
  let pg: typeof import('../src/data/deposito-postgres.js');

  beforeAll(async () => {
    pg = await import('../src/data/deposito-postgres.js');
    await pg.apri();
  });

  afterAll(async () => {
    await pg.pool().end();
  });

  it('una sessione sconosciuta parte dal fixture', async () => {
    const dati = await pg.load(`test-${crypto.randomUUID()}`);
    expect(dati.stato.streakGiorni).toBe(7);
  });

  it('due sessioni non si vedono a vicenda', async () => {
    const a = `test-${crypto.randomUUID()}`;
    const b = `test-${crypto.randomUUID()}`;
    const primo = await pg.load(a);
    await pg.load(b);
    await pg.save(a, { ...primo, stato: { ...primo.stato, gemmePortafoglio: 9999 } });

    expect((await pg.load(a)).stato.gemmePortafoglio).toBe(9999);
    expect((await pg.load(b)).stato.gemmePortafoglio).toBe(177.1);
  });

  it('rilegge da Postgres, non dalla cache', async () => {
    const id = `test-${crypto.randomUUID()}`;
    const dati = await pg.load(id);
    await pg.save(id, { ...dati, stato: { ...dati.stato, gemmePortafoglio: 1234 } });
    pg.svuotaCache();
    expect((await pg.load(id)).stato.gemmePortafoglio).toBe(1234);
  });
});

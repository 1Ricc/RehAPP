/**
 * Tests for per-session persistence.
 *
 * The scoring tests cover pure functions and never touch a disk. These are the
 * opposite: the whole point is what SQLite does across sessions and restarts,
 * so they run against a real database in a temp directory.
 *
 * `REHUB_DATA_DIR` has to be set before the store module is imported — it reads
 * the path once, at module load — which is why every import here is dynamic.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatiPersistiti } from '../src/domain/types.js';

const cartelle: string[] = [];

/** A store bound to its own empty directory, so no test can see another's rows. */
async function storeIsolato() {
  const dir = mkdtempSync(join(tmpdir(), 'rehub-store-'));
  cartelle.push(dir);
  process.env['REHUB_DATA_DIR'] = dir;
  vi.resetModules();
  const store = await import('../src/data/store.js');
  return { store, dir };
}

afterAll(() => {
  for (const dir of cartelle) rmSync(dir, { recursive: true, force: true });
  delete process.env['REHUB_DATA_DIR'];
});

describe('una riga per sessione', () => {
  let store: Awaited<ReturnType<typeof storeIsolato>>['store'];

  beforeEach(async () => {
    ({ store } = await storeIsolato());
  });

  it('una sessione sconosciuta parte dal fixture, non è un errore', async () => {
    const dati = await store.load('sessione-a');
    expect(dati.stato.streakGiorni).toBe(7);
    expect(dati.giornoCorrente.eserciziFatti).toEqual(['es-1-sollevamento']);
  });

  it('due sessioni non si vedono a vicenda', async () => {
    const a = await store.load('sessione-a');
    await store.load('sessione-b');

    await store.save('sessione-a', { ...a, stato: { ...a.stato, gemmePortafoglio: 9999 } });

    const dopoA = await store.load('sessione-a');
    const dopoB = await store.load('sessione-b');
    expect(dopoA.stato.gemmePortafoglio).toBe(9999);
    expect(dopoB.stato.gemmePortafoglio).toBe(177.1);
  });

  it('il reset di una sessione lascia intatta l’altra', async () => {
    const a = await store.load('sessione-a');
    const b = await store.load('sessione-b');
    await store.save('sessione-a', { ...a, stato: { ...a.stato, streakGiorni: 41 } });
    await store.save('sessione-b', { ...b, stato: { ...b.stato, streakGiorni: 12 } });

    await store.reset('sessione-a');

    expect((await store.load('sessione-a')).stato.streakGiorni).toBe(7);
    expect((await store.load('sessione-b')).stato.streakGiorni).toBe(12);
  });

  it('lo stato sopravvive alla cache: rileggendo da SQLite i dati sono gli stessi', async () => {
    const a = await store.load('sessione-a');
    await store.save('sessione-a', { ...a, stato: { ...a.stato, gemmePortafoglio: 1234 } });

    await store.svuotaCache();

    expect((await store.load('sessione-a')).stato.gemmePortafoglio).toBe(1234);
  });

  it('il login di uno non tocca la partita dell’altro', async () => {
    // What the shared-state version got wrong: `save` used to overwrite the one
    // and only row, so the second person to log in wiped the first.
    const a = await store.load('sessione-a');
    await store.save('sessione-a', { ...a, stato: { ...a.stato, streakGiorni: 30 } });

    const fresco = await store.load('sessione-b');
    await store.save('sessione-b', fresco);

    expect((await store.load('sessione-a')).stato.streakGiorni).toBe(30);
  });
});

describe('migrazione dalla vecchia tabella a riga singola', () => {
  it('apre un database con CHECK (id = 1) senza esplodere, ripartendo pulito', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rehub-store-vecchio-'));
    cartelle.push(dir);

    // Exactly the schema shipped before per-session state, committed state.db
    // included: every insert with a real session id would fail its CHECK.
    const vecchio = new Database(join(dir, 'state.db'));
    vecchio.exec(`
      CREATE TABLE stato (
        id      INTEGER PRIMARY KEY CHECK (id = 1),
        versione INTEGER NOT NULL,
        dati    TEXT    NOT NULL
      )
    `);
    vecchio.prepare('INSERT INTO stato (id, versione, dati) VALUES (1, 2, ?)').run('{"versione":2}');
    vecchio.close();

    process.env['REHUB_DATA_DIR'] = dir;
    vi.resetModules();
    const store = await import('../src/data/store.js');

    const dati = await store.load('una-sessione-qualunque');
    expect(dati.stato.streakGiorni).toBe(7);

    // And a second session still works, which the old CHECK would have refused.
    await store.load('un-altra-sessione');
    expect((await store.load('una-sessione-qualunque')).stato.streakGiorni).toBe(7);
  });
});

describe('la tabella non cresce senza limite', () => {
  it('le sessioni ferme da più di 48 ore vengono potate', async () => {
    const { store, dir } = await storeIsolato();

    await store.load('vecchia');
    await store.load('recente');

    // Backdate one row past the expiry, then force a prune by opening a new
    // session — the only moment the table can grow.
    const db = new Database(join(dir, 'state.db'));
    const treGiorniFa = Date.now() - 3 * 24 * 60 * 60 * 1000;
    db.prepare('UPDATE stato SET visto_il = ? WHERE id = ?').run(treGiorniFa, 'vecchia');
    db.close();

    await store.svuotaCache();
    await store.load('nuova-arrivata');

    const controllo = new Database(join(dir, 'state.db'));
    const rimaste = controllo
      .prepare<[], { id: string }>('SELECT id FROM stato')
      .all()
      .map((r) => r.id);
    controllo.close();

    expect(rimaste).not.toContain('vecchia');
    expect(rimaste).toContain('recente');
    expect(rimaste).toContain('nuova-arrivata');
  });
});

describe('il blob resta quello che il dominio si aspetta', () => {
  it('salva e rilegge senza perdere pezzi', async () => {
    const { store } = await storeIsolato();
    const dati = await store.load('sessione-a');

    const modificato: DatiPersistiti = {
      ...dati,
      voucher: [
        {
          id: 'v-1',
          ricompensaId: 'r-1',
          nome: 'Test',
          partner: 'Partner',
          codice: 'REHUB-AAAA-BBBB',
          gemmeSpese: 60,
          riscattatoIl: '2026-08-05',
        },
      ],
    };
    await store.save('sessione-a', modificato);
    await store.svuotaCache();

    const riletto = await store.load('sessione-a');
    expect(riletto.voucher).toHaveLength(1);
    expect(riletto.voucher[0]?.codice).toBe('REHUB-AAAA-BBBB');
    expect(riletto.piano.fasi).toHaveLength(dati.piano.fasi.length);
  });
});

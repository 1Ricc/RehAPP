import { describe, expect, it } from 'vitest';

import { hashPassword, verificaPassword } from '../src/domain/password.js';

describe('password', () => {
  it('una password verifica contro il proprio hash', async () => {
    const hash = await hashPassword('rehub123');
    expect(await verificaPassword('rehub123', hash)).toBe(true);
  });

  it('una password sbagliata non verifica', async () => {
    const hash = await hashPassword('rehub123');
    expect(await verificaPassword('rehub124', hash)).toBe(false);
  });

  it('due hash della stessa password sono diversi: il sale è casuale', async () => {
    expect(await hashPassword('uguale')).not.toBe(await hashPassword('uguale'));
  });

  it('la password in chiaro non compare nell’hash', async () => {
    expect(await hashPassword('segretissima')).not.toContain('segretissima');
  });

  it('un hash malformato è falso, non un’eccezione', async () => {
    expect(await verificaPassword('x', 'spazzatura')).toBe(false);
  });
});

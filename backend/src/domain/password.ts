/**
 * Password hashing, scrypt from node:crypto.
 *
 * scrypt because it is in the standard library — no dependency to audit — and
 * it is deliberately slow, which is the entire point. The comparison is
 * timing-safe: a plain === leaks how much of the hash matched.
 *
 * Nothing in this file ever logs. A hash in a log line is a hash somebody can
 * take away and grind offline.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const LUNGHEZZA = 64;

/** `"<sale hex>:<chiave hex>"`. The salt travels with the hash; that is normal. */
export async function hashPassword(password: string): Promise<string> {
  const sale = randomBytes(16).toString('hex');
  const chiave = await derive(password, sale, LUNGHEZZA);
  return `${sale}:${chiave.toString('hex')}`;
}

/** False for anything that is not a hash of this password, malformed included. */
export async function verificaPassword(password: string, memorizzata: string): Promise<boolean> {
  const [sale, atteso] = memorizzata.split(':');
  if (!sale || !atteso) return false;
  const chiave = await derive(password, sale, LUNGHEZZA);
  const attesoBuf = Buffer.from(atteso, 'hex');
  // timingSafeEqual throws on a length mismatch, and a truncated hash is a
  // malformed row, not an exception the caller should have to handle.
  if (attesoBuf.length !== chiave.length) return false;
  return timingSafeEqual(chiave, attesoBuf);
}

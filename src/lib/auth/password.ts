// Password hashing with scrypt (Node's built-in, memory-hard KDF). No 'server-only' import so the
// admin CLI script can reuse it. Format: scrypt$N$r$p$saltB64$hashB64
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize('NFKC'), salt, KEYLEN, { ...opts, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await derive(password, Buffer.from(saltB64, 'base64'), { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A precomputed hash used to equalise timing when the email does not exist. */
export const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

export function passwordProblems(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > 200) return 'Password is too long.';
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return 'Use letters and at least one number.';
  return null;
}

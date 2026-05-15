import { randomBytes } from 'crypto';

export function uuidV7Like(): string {
  const unixTsMs = BigInt(Date.now());
  const ts = unixTsMs.toString(16).padStart(12, '0').slice(-12);
  const rand = randomBytes(10).toString('hex');
  const variant = ((parseInt(rand.slice(3, 5), 16) & 0x3f) | 0x80).toString(16);
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${rand.slice(0, 3)}-${variant}${rand.slice(5, 7)}-${rand.slice(7, 19)}`;
}

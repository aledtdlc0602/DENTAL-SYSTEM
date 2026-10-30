import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** RFC 4648 base32 (sin padding), usado por Google Authenticator / Authy / Microsoft Authenticator. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Secreto base32 inválido');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** RFC 4226 HOTP. */
export function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

/** RFC 6238 TOTP (pasos de 30 s). */
export function totp(secret: string, time = Date.now(), step = 30): string {
  return hotp(secret, Math.floor(time / 1000 / step));
}

/** Verifica un código aceptando ±`window` pasos para tolerar desfase de reloj. */
export function verifyTotp(secret: string, code: string, window = 1, time = Date.now()): boolean {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const counter = Math.floor(time / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    const expected = Buffer.from(hotp(secret, counter + w));
    if (timingSafeEqual(expected, Buffer.from(code))) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, account: string, issuer = 'SIGO-Dental') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

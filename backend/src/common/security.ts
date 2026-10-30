import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Limitador simple en memoria contra fuerza bruta en el login (5 intentos fallidos / 15 min por IP+email).
 * Para varias instancias usar Redis (arquitectura sugerida en el SRS).
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function assertNotRateLimited(key: string) {
  const a = attempts.get(key);
  if (!a) return;
  if (Date.now() - a.first > WINDOW_MS) {
    attempts.delete(key);
    return;
  }
  if (a.count >= MAX_ATTEMPTS) {
    const mins = Math.ceil((WINDOW_MS - (Date.now() - a.first)) / 60000);
    throw new HttpException(`Demasiados intentos fallidos. Intente de nuevo en ${mins} min.`, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export function registerFailure(key: string) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else a.count++;
}

export function clearFailures(key: string) {
  attempts.delete(key);
}

/** Cabeceras de seguridad (equivalente básico a helmet, sin dependencias). */
export function securityHeaders(req: any, res: any, next: () => void) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.path?.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

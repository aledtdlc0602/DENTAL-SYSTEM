/**
 * La clínica opera en hora local (Ecuador continental UTC-5 por defecto) aunque el servidor esté en UTC.
 * CLINIC_UTC_OFFSET permite cambiarlo (ej. -6 para Galápagos).
 */
export const CLINIC_OFFSET_H = Number(process.env.CLINIC_UTC_OFFSET ?? -5);

/** Inicio y fin (instantes reales) de un día calendario local 'YYYY-MM-DD'. */
export function dayBounds(date?: string) {
  const base = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateKey(new Date());
  const [y, m, d] = base.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - CLINIC_OFFSET_H * 3600000);
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start, end, key: base };
}

/** 'YYYY-MM-DD' del instante dado en hora local de la clínica. */
export function localDateKey(d: Date) {
  return new Date(d.getTime() + CLINIC_OFFSET_H * 3600000).toISOString().slice(0, 10);
}

export function rangeBounds(from?: string, to?: string) {
  const start = from ? (from.length === 10 ? dayBounds(from).start : new Date(from)) : new Date(Date.now() - 30 * 86400000);
  const end = to ? (to.length === 10 ? dayBounds(to).end : new Date(to)) : new Date();
  return { start, end };
}

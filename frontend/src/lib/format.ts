export const TZ = 'America/Guayaquil';

export const money = (n: any) =>
  `$${Number(n ?? 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d: any) =>
  d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—';
/** Hora en formato de 24 h (08:30, 14:00), más compacto y sin ambigüedad en agenda. */
export const fmtTime = (d: any) => (d ? new Date(d).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '');
export const pct = (n: any) => `${Number(n ?? 0).toLocaleString('es-EC', { maximumFractionDigits: 1 })}%`;
export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** 'YYYY-MM-DD' en hora local del navegador. */
export function dateKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** Valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(d: Date) {
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const fullName = (p: any) => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '—');
export const drName = (d: any) => (d ? `Dr(a). ${d.firstName} ${d.lastName}` : '—');

export const APPT_STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: 'Programado', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  WAITING: { label: 'En sala de espera', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  IN_PROGRESS: { label: 'En atención', cls: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
  COMPLETED: { label: 'Atendido', cls: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  NO_SHOW: { label: 'No asistió', cls: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
};

/** RF-10: mismas transiciones que el backend (appointments/scheduling.ts). */
export const APPT_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['CONFIRMED', 'WAITING', 'IN_PROGRESS', 'NO_SHOW', 'CANCELLED'],
  CONFIRMED: ['WAITING', 'IN_PROGRESS', 'NO_SHOW', 'CANCELLED'],
  WAITING: ['IN_PROGRESS', 'NO_SHOW', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'WAITING'],
  COMPLETED: [],
  CANCELLED: ['SCHEDULED'],
  NO_SHOW: [],
};

export const PLAN_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
  PENDING_APPROVAL: { label: 'Pendiente de aprobación', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  APPROVED: { label: 'Aprobado', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  IN_PROGRESS: { label: 'En curso', cls: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
  COMPLETED: { label: 'Completado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
};

export const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  PLANNED: { label: 'Agendado', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  DONE: { label: 'Realizado', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
};

export const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
  ISSUED: { label: 'Emitida', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  PARTIALLY_PAID: { label: 'Abonada', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  PAID: { label: 'Pagada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  CANCELLED: { label: 'Anulada', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  CREDIT_NOTE: { label: 'Nota de crédito', cls: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
};

export const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta crédito/débito',
  TRANSFER: 'Transferencia',
  INSURANCE: 'Seguro / convenio',
  CHECK: 'Cheque',
  OTHER: 'Otro',
};

export const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  DENTIST: 'Odontólogo',
  RECEPTIONIST: 'Recepción / Caja',
  ASSISTANT: 'Asistente dental',
  ACCOUNTANT: 'Contador / Auditor',
};

export function errMsg(e: any) {
  return e?.message || 'Ocurrió un error';
}

/** Plural simple: plural(3, 'cita') → '3 citas'. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

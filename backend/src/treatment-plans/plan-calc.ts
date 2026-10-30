/** RF-07: totales del presupuesto por fases (honorarios, costo de laboratorio y descuentos). */
export interface ItemLike { quantity: number; unitPrice: number | any; discount?: number | any; labCost?: number | any; phase?: number | null; status?: string; approved?: boolean }

const n = (v: any) => Number(v ?? 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function planTotals(items: ItemLike[], planDiscount: number | any = 0) {
  const byPhase = new Map<number, { phase: number; subtotal: number; labCost: number; items: number }>();
  let gross = 0, itemDiscounts = 0, labCost = 0, approvedTotal = 0, doneTotal = 0;
  for (const it of items) {
    const line = n(it.unitPrice) * n(it.quantity);
    const net = line - n(it.discount);
    gross += line;
    itemDiscounts += n(it.discount);
    labCost += n(it.labCost) * n(it.quantity);
    if (it.approved) approvedTotal += net;
    if (it.status === 'DONE') doneTotal += net;
    const ph = it.phase ?? 1;
    const p = byPhase.get(ph) ?? { phase: ph, subtotal: 0, labCost: 0, items: 0 };
    p.subtotal += net;
    p.labCost += n(it.labCost) * n(it.quantity);
    p.items++;
    byPhase.set(ph, p);
  }
  const subtotal = gross - itemDiscounts;
  const total = Math.max(0, subtotal - n(planDiscount));
  return {
    gross: r2(gross),
    itemDiscounts: r2(itemDiscounts),
    subtotal: r2(subtotal),
    planDiscount: r2(n(planDiscount)),
    total: r2(total),
    labCost: r2(labCost),
    professionalFees: r2(total - labCost),
    approvedTotal: r2(approvedTotal),
    doneTotal: r2(doneTotal),
    discountPct: gross > 0 ? r2(((itemDiscounts + n(planDiscount)) / gross) * 100) : 0,
    phases: [...byPhase.values()].sort((a, b) => a.phase - b.phase).map((p) => ({ ...p, subtotal: r2(p.subtotal), labCost: r2(p.labCost) })),
  };
}

/** Porcentaje máximo de descuento que puede aplicar un rol sin autorización del administrador. */
export function maxDiscountFor(role: string) {
  const limit = Number(process.env.MAX_DISCOUNT_PCT_WITHOUT_ADMIN || 10);
  return role === 'ADMIN' || role === 'SUPERADMIN' ? 100 : limit;
}

export const PLAN_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
  PENDING_APPROVAL: ['DRAFT', 'APPROVED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: ['DRAFT'],
};

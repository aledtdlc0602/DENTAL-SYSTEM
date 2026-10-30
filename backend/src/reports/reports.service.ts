import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dayBounds, localDateKey, rangeBounds } from '../common/time';

const r2 = (v: number) => Math.round(v * 100) / 100;
const FINANCE_ROLES = ['ADMIN', 'SUPERADMIN', 'ACCOUNTANT'];

/** Fase 3: reportes BI y tablero (RNF-01: una sola consulta agregada en lugar de traer toda la agenda). */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard(clinicId: string, user: { userId: string; role: string }) {
    const today = dayBounds();
    const monthStart = dayBounds(today.key.slice(0, 8) + '01').start;
    const since30 = new Date(Date.now() - 30 * 86400000);
    const dentistFilter = user.role === 'DENTIST' ? { dentistId: user.userId } : {};

    const [patients, newPatients, todayAppts, last30, products, pendingPlans, unsignedNotes] = await Promise.all([
      this.prisma.patient.count({ where: { clinicId, isActive: true } }),
      this.prisma.patient.count({ where: { clinicId, createdAt: { gte: monthStart } } }),
      this.prisma.appointment.findMany({
        where: { clinicId, ...dentistFilter, startAt: { gte: today.start, lte: today.end } },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, medicalHistory: { select: { alerts: true } } } },
          dentist: { select: { firstName: true, lastName: true } },
          room: { select: { name: true } },
        },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.appointment.groupBy({ by: ['status'], where: { clinicId, ...dentistFilter, startAt: { gte: since30, lte: new Date() } }, _count: true }),
      this.prisma.product.findMany({ where: { clinicId, isActive: true }, select: { stock: true, minStock: true } }),
      this.prisma.treatmentPlan.count({ where: { clinicId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } } }),
      this.prisma.clinicalNote.count({ where: { clinicId, signedAt: null, isLocked: false, ...(user.role === 'DENTIST' ? { authorId: user.userId } : {}) } }),
    ]);

    const statusCount = Object.fromEntries(last30.map((g: any) => [g.status, g._count]));
    const attended = (statusCount.COMPLETED || 0) + (statusCount.NO_SHOW || 0);
    const result: any = {
      patients,
      newPatientsThisMonth: newPatients,
      today: {
        total: todayAppts.length,
        byStatus: todayAppts.reduce((m: any, a) => ((m[a.status] = (m[a.status] || 0) + 1), m), {}),
        list: todayAppts,
      },
      noShowRate30d: attended ? r2(((statusCount.NO_SHOW || 0) / attended) * 100) : 0,
      lowStock: products.filter((p) => Number(p.stock) <= Number(p.minStock)).length,
      pendingPlans,
      unsignedNotes,
    };

    if (FINANCE_ROLES.includes(user.role)) {
      const [paymentsToday, paymentsMonth, receivable] = await Promise.all([
        this.prisma.payment.aggregate({ where: { invoice: { clinicId }, paidAt: { gte: today.start, lte: today.end } }, _sum: { amount: true } }),
        this.prisma.payment.aggregate({ where: { invoice: { clinicId }, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
        this.prisma.invoice.aggregate({ where: { clinicId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } }, _sum: { total: true, paidAmount: true } }),
      ]);
      result.revenueToday = r2(Number(paymentsToday._sum.amount ?? 0));
      result.revenueMonth = r2(Number(paymentsMonth._sum.amount ?? 0));
      result.accountsReceivable = r2(Number(receivable._sum.total ?? 0) - Number(receivable._sum.paidAmount ?? 0));
    }
    return result;
  }

  async summary(clinicId: string, from?: string, to?: string) {
    const { start, end } = rangeBounds(from, to);
    const [payments, invoices, appointments, newPatients, plans, movements] = await Promise.all([
      this.prisma.payment.findMany({ where: { invoice: { clinicId }, paidAt: { gte: start, lte: end } }, select: { amount: true, method: true, paidAt: true } }),
      this.prisma.invoice.findMany({ where: { clinicId, issuedAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } }, include: { items: true } }),
      this.prisma.appointment.findMany({
        where: { clinicId, startAt: { gte: start, lte: end } },
        select: { status: true, dentistId: true, roomId: true, startAt: true, endAt: true, procedureId: true, dentist: { select: { firstName: true, lastName: true } }, procedure: { select: { name: true, category: true, price: true } } },
      }),
      this.prisma.patient.count({ where: { clinicId, createdAt: { gte: start, lte: end } } }),
      this.prisma.treatmentPlan.findMany({ where: { clinicId, createdAt: { gte: start, lte: end } }, select: { status: true, totalAmount: true } }),
      this.prisma.stockMovement.findMany({ where: { clinicId, type: 'OUT', createdAt: { gte: start, lte: end } }, include: { product: { select: { name: true, unitCost: true } } } }),
    ]);

    // Ingresos por día y por método
    const byDay = new Map<string, number>();
    const byMethod: Record<string, number> = {};
    let revenue = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      revenue += amt;
      const k = localDateKey(p.paidAt);
      byDay.set(k, (byDay.get(k) || 0) + amt);
      byMethod[p.method] = r2((byMethod[p.method] || 0) + amt);
    }
    const days: { date: string; revenue: number }[] = [];
    for (let t = dayBounds(localDateKey(start)).start.getTime(); t <= end.getTime(); t += 86400000) {
      const k = localDateKey(new Date(t + 12 * 3600000));
      if (!days.length || days[days.length - 1].date !== k) days.push({ date: k, revenue: r2(byDay.get(k) || 0) });
    }

    // Facturado por concepto
    const byConcept = new Map<string, { name: string; count: number; amount: number }>();
    let billed = 0;
    for (const inv of invoices) {
      billed += Number(inv.total);
      for (const it of inv.items) {
        const name = it.description.split(' - pieza')[0].split(' (')[0];
        const c = byConcept.get(name) ?? { name, count: 0, amount: 0 };
        c.count += it.quantity;
        c.amount += Number(it.total);
        byConcept.set(name, c);
      }
    }

    // Agenda
    const statusCount: Record<string, number> = {};
    const byDentist = new Map<string, { name: string; completed: number; noShow: number; production: number; minutes: number }>();
    const byCategory = new Map<string, number>();
    for (const a of appointments) {
      statusCount[a.status] = (statusCount[a.status] || 0) + 1;
      const d = byDentist.get(a.dentistId) ?? { name: `${a.dentist.firstName} ${a.dentist.lastName}`, completed: 0, noShow: 0, production: 0, minutes: 0 };
      if (a.status === 'COMPLETED') {
        d.completed++;
        d.production += Number(a.procedure?.price ?? 0);
        d.minutes += (a.endAt.getTime() - a.startAt.getTime()) / 60000;
        const cat = a.procedure?.category ?? 'Sin categoría';
        byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
      }
      if (a.status === 'NO_SHOW') d.noShow++;
      byDentist.set(a.dentistId, d);
    }
    const attended = (statusCount.COMPLETED || 0) + (statusCount.NO_SHOW || 0);

    // Presupuestos
    const accepted = plans.filter((p) => ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(p.status));
    const materials = new Map<string, number>();
    let materialsCost = 0;
    for (const m of movements) {
      const cost = Number(m.quantity) * Number(m.product.unitCost);
      materialsCost += cost;
      materials.set(m.product.name, (materials.get(m.product.name) || 0) + cost);
    }

    return {
      period: { from: localDateKey(start), to: localDateKey(end) },
      revenue: r2(revenue),
      billed: r2(billed),
      invoices: invoices.length,
      averageTicket: invoices.length ? r2(billed / invoices.length) : 0,
      revenueByDay: days,
      revenueByMethod: byMethod,
      topConcepts: [...byConcept.values()].map((c) => ({ ...c, amount: r2(c.amount) })).sort((a, b) => b.amount - a.amount).slice(0, 10),
      appointments: { total: appointments.length, byStatus: statusCount, noShowRate: attended ? r2(((statusCount.NO_SHOW || 0) / attended) * 100) : 0 },
      byDentist: [...byDentist.values()].map((d) => ({ ...d, production: r2(d.production), hours: r2(d.minutes / 60) })).sort((a, b) => b.production - a.production),
      byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      newPatients,
      plans: {
        created: plans.length,
        accepted: accepted.length,
        conversionRate: plans.length ? r2((accepted.length / plans.length) * 100) : 0,
        acceptedAmount: r2(accepted.reduce((s, p) => s + Number(p.totalAmount), 0)),
      },
      materials: {
        cost: r2(materialsCost),
        top: [...materials.entries()].map(([name, cost]) => ({ name, cost: r2(cost) })).sort((a, b) => b.cost - a.cost).slice(0, 8),
      },
    };
  }
}

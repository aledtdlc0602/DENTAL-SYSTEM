import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { commissionFor, pickRule } from './commission-calc';

const r2 = (v: number) => Math.round(v * 100) / 100;

@Injectable()
export class CommissionsService {
  constructor(private prisma: PrismaService) {}

  async createRule(clinicId: string, data: { name: string; type?: string; value: number; procedureId?: string; dentistId?: string }) {
    if (!['PERCENT_GROSS', 'PERCENT_AFTER_COST', 'FIXED_AMOUNT'].includes(data.type || 'PERCENT_GROSS')) throw new BadRequestException('Tipo de regla inválido');
    if (data.type !== 'FIXED_AMOUNT' && (data.value < 0 || data.value > 100)) throw new BadRequestException('El porcentaje debe estar entre 0 y 100');
    return this.prisma.commissionRule.create({
      data: { clinicId, name: data.name, type: data.type || 'PERCENT_GROSS', value: data.value, procedureId: data.procedureId || null, dentistId: data.dentistId || null },
    });
  }

  async updateRule(clinicId: string, id: string, data: { name?: string; type?: string; value?: number; isActive?: boolean }) {
    const rule = await this.prisma.commissionRule.findFirst({ where: { id, clinicId } });
    if (!rule) throw new NotFoundException('Regla no encontrada');
    return this.prisma.commissionRule.update({ where: { id }, data });
  }

  listRules(clinicId: string) {
    return this.prisma.commissionRule.findMany({ where: { clinicId, isActive: true }, orderBy: { name: 'asc' } });
  }

  private range(from: string, to: string) {
    const start = new Date(from.length === 10 ? `${from}T00:00:00` : from);
    const end = new Date(to.length === 10 ? `${to}T23:59:59.999` : to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) throw new BadRequestException('Rango de fechas inválido');
    return { start, end };
  }

  /**
   * RF-13: liquidación de honorarios de un odontólogo.
   * Base = valor real del procedimiento atendido (precio del ítem del presupuesto si la cita viene de uno,
   * o precio del catálogo). Costos = laboratorio + materiales de la receta de consumo (RF-14).
   */
  async calculateSettlement(clinicId: string, dentistId: string, from: string, to: string) {
    const { start, end } = this.range(from, to);
    const dentist = await this.prisma.user.findFirst({ where: { id: dentistId, clinicId } });
    if (!dentist) throw new NotFoundException('Odontólogo no encontrado');

    const [appointments, rules, procedures] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { clinicId, dentistId, status: 'COMPLETED', startAt: { gte: start, lte: end } },
        include: { patient: { select: { firstName: true, lastName: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.listRules(clinicId),
      this.prisma.procedure.findMany({
        where: { clinicId },
        include: { consumptions: { include: { product: { select: { unitCost: true } } } } },
      }),
    ]);
    const procById = new Map(procedures.map((p) => [p.id, p]));
    const procByName = new Map(procedures.map((p) => [p.name.toLowerCase(), p]));
    const itemIds = appointments.map((a) => a.treatmentPlanItemId).filter(Boolean) as string[];
    const planItems = itemIds.length ? await this.prisma.treatmentPlanItem.findMany({ where: { id: { in: itemIds } } }) : [];
    const itemById = new Map<string, any>(planItems.map((i) => [i.id, i]));
    const fallback = procedures.find((p) => /consulta/i.test(p.name));

    let gross = 0, commissionTotal = 0, labTotal = 0, materialsTotal = 0;
    const byProcedure = new Map<string, { name: string; count: number; gross: number; commission: number }>();
    const lines = appointments.map((a) => {
      const proc =
        (a.procedureId && procById.get(a.procedureId)) ||
        procByName.get((a.reason || '').split(' - ')[0].split(' (')[0].trim().toLowerCase()) ||
        fallback;
      const item = a.treatmentPlanItemId ? itemById.get(a.treatmentPlanItemId) : undefined;
      const amount = item
        ? Number(item.unitPrice) * item.quantity - Number(item.discount)
        : Number(proc?.price ?? 0);
      const lab = item ? Number(item.labCost) * item.quantity : Number((proc as any)?.labCost ?? 0);
      const materials = (proc?.consumptions ?? []).reduce((s, c) => s + Number(c.quantity) * Number(c.product.unitCost), 0);
      const rule = pickRule(rules as any[], dentistId, proc?.id);
      const calc = commissionFor(rule, amount, { lab, materials });

      gross += amount;
      commissionTotal += calc.commission;
      labTotal += lab;
      materialsTotal += materials;
      const key = proc?.name ?? 'Sin procedimiento';
      const agg = byProcedure.get(key) ?? { name: key, count: 0, gross: 0, commission: 0 };
      agg.count++;
      agg.gross += amount;
      agg.commission += calc.commission;
      byProcedure.set(key, agg);

      return {
        appointmentId: a.id,
        date: a.startAt,
        patient: `${a.patient.firstName} ${a.patient.lastName}`,
        procedure: key,
        amount: r2(amount),
        labCost: r2(lab),
        materialsCost: r2(materials),
        ruleName: (rule as any)?.name ?? 'Por defecto 40%',
        ruleType: calc.type,
        ruleValue: calc.value,
        base: calc.base,
        commission: calc.commission,
      };
    });

    return {
      dentist: { id: dentist.id, name: `${dentist.firstName} ${dentist.lastName}` },
      period: { from, to },
      appointmentsCount: appointments.length,
      gross: r2(gross),
      labCost: r2(labTotal),
      materialsCost: r2(materialsTotal),
      commissionTotal: r2(commissionTotal),
      clinicNet: r2(gross - commissionTotal - labTotal - materialsTotal),
      byProcedure: [...byProcedure.values()].map((p) => ({ ...p, gross: r2(p.gross), commission: r2(p.commission) })).sort((a, b) => b.gross - a.gross),
      lines,
    };
  }

  /** Resumen de honorarios de todos los odontólogos del período (para contabilidad). */
  async settlementAll(clinicId: string, from: string, to: string) {
    const dentists = await this.prisma.user.findMany({ where: { clinicId, role: 'DENTIST', isActive: true }, orderBy: { lastName: 'asc' } });
    const rows = [];
    for (const d of dentists) {
      const s = await this.calculateSettlement(clinicId, d.id, from, to);
      rows.push({ dentistId: d.id, name: s.dentist.name, appointments: s.appointmentsCount, gross: s.gross, labCost: s.labCost, materialsCost: s.materialsCost, commission: s.commissionTotal });
    }
    return {
      period: { from, to },
      rows,
      totals: {
        gross: r2(rows.reduce((a, r) => a + r.gross, 0)),
        commission: r2(rows.reduce((a, r) => a + r.commission, 0)),
        appointments: rows.reduce((a, r) => a + r.appointments, 0),
      },
    };
  }
}

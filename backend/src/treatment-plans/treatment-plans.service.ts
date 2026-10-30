import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTreatmentPlanDto, PlanItemDto, ScheduleDto } from './dto/create-treatment-plan.dto';
import { maxDiscountFor, planTotals, PLAN_TRANSITIONS } from './plan-calc';
import { assertNoConflicts } from '../appointments/scheduling';

const INCLUDE = {
  items: { include: { procedure: true }, orderBy: [{ phase: 'asc' as const }, { id: 'asc' as const }] },
  patient: { select: { id: true, firstName: true, lastName: true, documentNumber: true, phone: true, email: true } },
};

@Injectable()
export class TreatmentPlansService {
  constructor(private prisma: PrismaService) {}

  private withTotals(plan: any) {
    return plan ? { ...plan, totals: planTotals(plan.items ?? [], plan.discount) } : plan;
  }

  private async buildItems(clinicId: string, items: PlanItemDto[]) {
    const procedures = await this.prisma.procedure.findMany({ where: { id: { in: items.map((i) => i.procedureId) }, clinicId } });
    const byId = new Map<string, any>(procedures.map((p) => [p.id, p]));
    return items.map((item) => {
      const proc = byId.get(item.procedureId);
      if (!proc) throw new NotFoundException(`Procedimiento ${item.procedureId} no existe en la clínica`);
      const quantity = item.quantity ?? 1;
      const unitPrice = item.unitPrice ?? Number(proc.price);
      const discount = item.discount ?? 0;
      if (discount > unitPrice * quantity) throw new BadRequestException(`El descuento de "${proc.name}" supera el valor del ítem`);
      return {
        procedureId: item.procedureId,
        toothNumber: item.toothNumber,
        surface: item.surface as any,
        quantity,
        unitPrice,
        labCost: item.labCost ?? Number((proc as any).labCost ?? 0),
        discount,
        phase: item.phase ?? 1,
        notes: item.notes,
        status: 'PENDING' as const,
      };
    });
  }

  /** RF-07: descuentos sobre el límite del rol requieren a un administrador ("descuentos autorizados"). */
  private assertDiscountAllowed(items: { unitPrice: number; quantity: number; discount: number }[], planDiscount: number, role: string) {
    const totals = planTotals(items as any, planDiscount);
    const limit = maxDiscountFor(role);
    if (totals.discountPct > limit) {
      throw new ForbiddenException(`Descuento de ${totals.discountPct}% supera el ${limit}% permitido para su rol; requiere autorización de un administrador`);
    }
    return totals;
  }

  async create(clinicId: string, dto: CreateTreatmentPlanDto, user: { userId?: string; role: string }) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId, isActive: true } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (!dto.items?.length) throw new BadRequestException('El plan debe tener al menos un ítem');

    const items = await this.buildItems(clinicId, dto.items);
    const totals = this.assertDiscountAllowed(items, dto.discount ?? 0, user.role);

    const plan = await this.prisma.treatmentPlan.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        title: dto.title || `Plan de tratamiento - ${patient.firstName} ${patient.lastName}`,
        notes: dto.notes,
        discount: dto.discount ?? 0,
        totalAmount: totals.total,
        status: dto.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'DRAFT',
        createdById: user.userId,
        items: { create: items },
      },
      include: INCLUDE,
    });
    return this.withTotals(plan);
  }

  async findAll(clinicId: string, patientId?: string, status?: string) {
    const plans = await this.prisma.treatmentPlan.findMany({
      where: { clinicId, ...(patientId ? { patientId } : {}), ...(status ? { status: status as any } : {}) },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return plans.map((p) => this.withTotals(p));
  }

  async findOne(clinicId: string, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({ where: { id, clinicId }, include: INCLUDE });
    if (!plan) throw new NotFoundException('Plan de tratamiento no encontrado');
    const appointments = await this.prisma.appointment.findMany({
      where: { clinicId, treatmentPlanItemId: { in: plan.items.map((i) => i.id) } },
      select: { id: true, startAt: true, status: true, treatmentPlanItemId: true },
    });
    return { ...this.withTotals(plan), appointments };
  }

  /** Reemplaza ítems y descuento mientras el presupuesto no esté aprobado. */
  async update(clinicId: string, id: string, dto: Partial<CreateTreatmentPlanDto>, role: string) {
    const plan = await this.findOne(clinicId, id);
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(plan.status)) throw new BadRequestException('Solo se edita un presupuesto en borrador o pendiente de aprobación');
    const items = dto.items ? await this.buildItems(clinicId, dto.items) : null;
    const discount = dto.discount ?? Number(plan.discount);
    const totals = this.assertDiscountAllowed(items ?? (plan.items as any), discount, role);
    await this.prisma.$transaction([
      ...(items ? [this.prisma.treatmentPlanItem.deleteMany({ where: { treatmentPlanId: id } })] : []),
      this.prisma.treatmentPlan.update({
        where: { id },
        data: {
          title: dto.title ?? undefined,
          notes: dto.notes ?? undefined,
          discount,
          totalAmount: totals.total,
          ...(items ? { items: { create: items } } : {}),
        },
      }),
    ]);
    return this.findOne(clinicId, id);
  }

  async updateStatus(clinicId: string, id: string, status: string) {
    const plan = await this.findOne(clinicId, id);
    if (!(status in PLAN_TRANSITIONS)) throw new BadRequestException(`Estado inválido: ${status}`);
    if (plan.status !== status && !PLAN_TRANSITIONS[plan.status].includes(status)) {
      throw new BadRequestException(`No se puede pasar de ${plan.status} a ${status}`);
    }
    const data: any = { status };
    if (status === 'APPROVED') {
      data.approvedAt = new Date();
      await this.prisma.treatmentPlanItem.updateMany({ where: { treatmentPlanId: id, status: { not: 'DONE' } }, data: { approved: true } });
    }
    await this.prisma.treatmentPlan.update({ where: { id }, data });
    return this.findOne(clinicId, id);
  }

  async updateItemStatus(clinicId: string, planId: string, itemId: string, status: string) {
    const plan = await this.findOne(clinicId, planId);
    const item = plan.items.find((i: any) => i.id === itemId);
    if (!item) throw new NotFoundException('El ítem no pertenece a este plan');
    if (!['PENDING', 'PLANNED', 'DONE'].includes(status)) throw new BadRequestException('Estado de ítem inválido');
    if (item.status === 'DONE') throw new BadRequestException('RN-01: un procedimiento Realizado no puede modificarse');
    await this.prisma.treatmentPlanItem.update({ where: { id: itemId }, data: { status: status as any } });
    return this.findOne(clinicId, planId);
  }

  /** RF-08: aprobación total o parcial (solo los ítems autorizados por el paciente). */
  async approve(clinicId: string, planId: string, itemIds?: string[]) {
    const plan = await this.findOne(clinicId, planId);
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(plan.status)) {
      throw new BadRequestException('El plan no está en un estado aprobable');
    }
    const selectable = plan.items.filter((i: any) => i.status !== 'DONE');
    const chosen = itemIds?.length ? selectable.filter((i: any) => itemIds.includes(i.id)) : selectable;
    if (!chosen.length) throw new BadRequestException('Seleccione al menos un ítem a aprobar');
    await this.prisma.treatmentPlanItem.updateMany({ where: { id: { in: chosen.map((i: any) => i.id) } }, data: { approved: true } });
    if (['DRAFT', 'PENDING_APPROVAL'].includes(plan.status)) {
      await this.prisma.treatmentPlan.update({ where: { id: planId }, data: { status: 'APPROVED', approvedAt: new Date() } });
    }
    return this.findOne(clinicId, planId);
  }

  /**
   * RF-08: aprueba (total o parcialmente) y convierte los ítems autorizados en citas agendadas.
   * Cada cita queda enlazada al ítem y al procedimiento (al completarla se descargan insumos y el ítem pasa a Realizado).
   * Valida RN-03 para todas las citas ANTES de crear cualquiera.
   */
  async approveAndSchedule(clinicId: string, planId: string, options: ScheduleDto, userId?: string) {
    const plan = await this.approve(clinicId, planId, options.itemIds);
    const alreadyScheduled = new Set(
      plan.appointments.filter((a: any) => !['CANCELLED', 'NO_SHOW'].includes(a.status)).map((a: any) => a.treatmentPlanItemId),
    );
    const items = plan.items.filter(
      (i: any) => i.approved && i.status !== 'DONE' && !alreadyScheduled.has(i.id) && (!options.itemIds?.length || options.itemIds.includes(i.id)),
    );
    if (!items.length) throw new BadRequestException('No hay ítems aprobados pendientes de agendar');

    const dentist = await this.prisma.user.findFirst({ where: { id: options.dentistId, clinicId, isActive: true } });
    if (!dentist) throw new NotFoundException('Odontólogo no encontrado');

    // Construir los bloques: uno por ítem, o uno por fase
    const blocks: { items: any[]; minutes: number }[] = [];
    if (options.groupByPhase) {
      const phases = new Map<number, any[]>();
      for (const it of items) phases.set(it.phase ?? 1, [...(phases.get(it.phase ?? 1) ?? []), it]);
      for (const list of [...phases.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l)) {
        blocks.push({ items: list, minutes: list.reduce((s, it) => s + (options.durationMinPerItem ?? it.procedure?.durationMin ?? 30), 0) });
      }
    } else {
      for (const it of items) blocks.push({ items: [it], minutes: options.durationMinPerItem ?? it.procedure?.durationMin ?? 30 });
    }

    let cursor = new Date(options.startAt);
    if (isNaN(cursor.getTime())) throw new BadRequestException('Fecha de inicio inválida');
    const slots = blocks.map((b) => {
      const startAt = cursor;
      const endAt = new Date(startAt.getTime() + b.minutes * 60000);
      cursor = endAt;
      return { ...b, startAt, endAt };
    });
    for (const s of slots) {
      await assertNoConflicts(this.prisma, { clinicId, startAt: s.startAt, endAt: s.endAt, dentistId: options.dentistId, roomId: options.roomId, patientId: plan.patientId });
    }

    const created = [];
    for (const s of slots) {
      const first = s.items[0];
      const appt = await this.prisma.appointment.create({
        data: {
          clinicId,
          patientId: plan.patientId,
          dentistId: options.dentistId,
          roomId: options.roomId || null,
          startAt: s.startAt,
          endAt: s.endAt,
          procedureId: first.procedureId,
          treatmentPlanItemId: first.id,
          reason: s.items.map((it: any) => `${it.procedure?.name}${it.toothNumber ? ` (pieza ${it.toothNumber})` : ''}`).join(' + '),
          notes: `Presupuesto: ${plan.title}${s.items.length > 1 ? ` · Fase ${first.phase}` : ''}`,
          status: 'SCHEDULED',
          createdById: userId,
        },
        include: { dentist: { select: { firstName: true, lastName: true } }, room: true },
      });
      created.push(appt);
    }
    await this.prisma.treatmentPlanItem.updateMany({
      where: { id: { in: slots.flatMap((s) => s.items.map((i: any) => i.id)) }, status: 'PENDING' },
      data: { status: 'PLANNED' },
    });

    return {
      plan: await this.findOne(clinicId, planId),
      appointments: created,
      message: `Presupuesto aprobado. Se generaron ${created.length} cita(s).`,
    };
  }
}

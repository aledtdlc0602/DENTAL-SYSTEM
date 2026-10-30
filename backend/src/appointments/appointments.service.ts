import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertNoConflicts, assertTransition } from './scheduling';

const INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, phone: true, documentNumber: true, medicalHistory: { select: { alerts: true } } } },
  dentist: { select: { id: true, firstName: true, lastName: true } },
  room: true,
  procedure: { select: { id: true, name: true, category: true, price: true, durationMin: true } },
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger('Appointments');

  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private notifications: NotificationsService,
  ) {}

  async create(clinicId: string, dto: CreateAppointmentDto, createdById?: string) {
    const [patient, dentist, procedure] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId, isActive: true } }),
      this.prisma.user.findFirst({ where: { id: dto.dentistId, clinicId, isActive: true, role: { in: ['DENTIST', 'ADMIN'] } } }),
      dto.procedureId ? this.prisma.procedure.findFirst({ where: { id: dto.procedureId, clinicId } }) : null,
    ]);
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (!dentist) throw new NotFoundException('Odontólogo no encontrado');
    if (dto.procedureId && !procedure) throw new NotFoundException('Procedimiento no encontrado');
    if (dto.roomId && !(await this.prisma.room.findFirst({ where: { id: dto.roomId, clinicId } }))) {
      throw new NotFoundException('Sillón no encontrado');
    }

    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt ? new Date(dto.endAt) : new Date(startAt.getTime() + (procedure?.durationMin ?? 30) * 60000);
    await assertNoConflicts(this.prisma, { clinicId, startAt, endAt, dentistId: dto.dentistId, roomId: dto.roomId, patientId: dto.patientId });

    const appt = await this.prisma.appointment.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        dentistId: dto.dentistId,
        roomId: dto.roomId || null,
        procedureId: dto.procedureId || null,
        treatmentPlanItemId: dto.treatmentPlanItemId || null,
        startAt,
        endAt,
        reason: dto.reason || procedure?.name,
        notes: dto.notes,
        status: (dto.status as any) || 'SCHEDULED',
        createdById,
      },
      include: INCLUDE,
    });

    // RF-11: mensaje transaccional de confirmación (no bloquea la creación)
    this.notifications.notifyAppointment(clinicId, appt.id, 'CONFIRMATION').catch((e) => this.logger.warn(e?.message));
    return appt;
  }

  async findAll(
    clinicId: string,
    filters: { dentistId?: string; patientId?: string; roomId?: string; date?: string; from?: string; to?: string; status?: string },
  ) {
    const where: any = { clinicId };
    if (filters.dentistId) where.dentistId = filters.dentistId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.roomId) where.roomId = filters.roomId;
    if (filters.status) where.status = { in: filters.status.split(',') };

    if (filters.from || filters.to) {
      where.startAt = {};
      if (filters.from) where.startAt.gte = new Date(filters.from);
      if (filters.to) where.startAt.lte = new Date(filters.to);
    } else if (filters.date) {
      const dayStart = new Date(`${filters.date}T00:00:00`);
      const dayEnd = new Date(`${filters.date}T23:59:59.999`);
      where.startAt = { gte: dayStart, lte: dayEnd };
    } else {
      // Sin filtros de fecha: ventana razonable (RNF-01 rendimiento)
      where.startAt = { gte: new Date(Date.now() - 30 * 86400000), lte: new Date(Date.now() + 60 * 86400000) };
    }

    return this.prisma.appointment.findMany({ where, include: INCLUDE, orderBy: { startAt: 'asc' } });
  }

  async findOne(clinicId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
      include: { ...INCLUDE, clinicalNotes: true },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    return appointment;
  }

  /** Reprogramar / editar: vuelve a validar RN-03. */
  async update(clinicId: string, id: string, dto: UpdateAppointmentDto) {
    const current = await this.findOne(clinicId, id);
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(current.status)) {
      throw new BadRequestException('No se puede editar una cita atendida, cancelada o con inasistencia');
    }
    const { status, ...rest } = dto as any;
    if (status && status !== current.status) assertTransition(current.status, status);

    const startAt = rest.startAt ? new Date(rest.startAt) : current.startAt;
    const endAt = rest.endAt ? new Date(rest.endAt) : rest.startAt ? new Date(startAt.getTime() + (current.endAt.getTime() - current.startAt.getTime())) : current.endAt;
    const dentistId = rest.dentistId ?? current.dentistId;
    const roomId = rest.roomId !== undefined ? rest.roomId || null : current.roomId;
    const patientId = rest.patientId ?? current.patientId;
    await assertNoConflicts(this.prisma, { clinicId, startAt, endAt, dentistId, roomId, patientId, excludeId: id });

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        patientId,
        dentistId,
        roomId,
        startAt,
        endAt,
        reason: rest.reason ?? undefined,
        notes: rest.notes ?? undefined,
        procedureId: rest.procedureId ?? undefined,
        status: status ?? undefined,
      },
      include: INCLUDE,
    });
    if (rest.startAt && startAt.getTime() !== current.startAt.getTime()) {
      this.notifications.notifyAppointment(clinicId, id, 'RESCHEDULED').catch((e) => this.logger.warn(e?.message));
    }
    return updated;
  }

  /** RF-10: cambio de estado con transiciones válidas. Al pasar a "Atendido" ejecuta RF-14 y RF-08. */
  async updateStatus(clinicId: string, id: string, status: string, userId?: string) {
    const appt = await this.findOne(clinicId, id);
    assertTransition(appt.status, status);

    if (appt.status === 'CANCELLED' && status === 'SCHEDULED') {
      await assertNoConflicts(this.prisma, { clinicId, startAt: appt.startAt, endAt: appt.endAt, dentistId: appt.dentistId, roomId: appt.roomId, patientId: appt.patientId, excludeId: id });
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: status as any },
      include: INCLUDE,
    });

    let inventory: any[] | undefined;
    if (status === 'COMPLETED') {
      // RF-14: descargo automático de insumos según receta de consumo (una sola vez)
      if (appt.procedureId && !appt.inventoryDischargedAt) {
        inventory = await this.inventory.consumeForProcedure(clinicId, appt.procedureId, userId, appt.id);
        await this.prisma.appointment.update({ where: { id }, data: { inventoryDischargedAt: new Date() } });
      }
      // RF-08: el ítem del presupuesto pasa a Realizado y el plan avanza
      if (appt.treatmentPlanItemId) await this.completePlanItem(clinicId, appt.treatmentPlanItemId);
    }
    if (status === 'NO_SHOW') {
      this.notifications.notifyAppointment(clinicId, id, 'NO_SHOW_FOLLOWUP').catch((e) => this.logger.warn(e?.message));
    }
    return { ...updated, inventory };
  }

  private async completePlanItem(clinicId: string, itemId: string) {
    const item = await this.prisma.treatmentPlanItem.findFirst({ where: { id: itemId, treatmentPlan: { clinicId } } });
    if (!item || item.status === 'DONE') return;
    await this.prisma.treatmentPlanItem.update({ where: { id: itemId }, data: { status: 'DONE' } });
    const items = await this.prisma.treatmentPlanItem.findMany({ where: { treatmentPlanId: item.treatmentPlanId } });
    const relevant = items.filter((i) => i.approved || i.status !== 'PENDING');
    const allDone = relevant.length > 0 && relevant.every((i) => i.status === 'DONE');
    await this.prisma.treatmentPlan.update({ where: { id: item.treatmentPlanId }, data: { status: allDone ? 'COMPLETED' : 'IN_PROGRESS' } });
  }

  async remove(clinicId: string, id: string) {
    return this.updateStatus(clinicId, id, 'CANCELLED');
  }
}

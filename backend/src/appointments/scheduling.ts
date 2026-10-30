import { BadRequestException, ConflictException } from '@nestjs/common';

export const ACTIVE_STATUSES = ['SCHEDULED', 'CONFIRMED', 'WAITING', 'IN_PROGRESS', 'COMPLETED'];

/** RF-10: transiciones permitidas entre estados del turno. */
export const TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['CONFIRMED', 'WAITING', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['SCHEDULED', 'WAITING', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  WAITING: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'WAITING'],
  COMPLETED: [],
  CANCELLED: ['SCHEDULED'],
  NO_SHOW: [],
};

export const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado', CONFIRMED: 'Confirmado', WAITING: 'En sala de espera', IN_PROGRESS: 'En atención',
  COMPLETED: 'Atendido', CANCELLED: 'Cancelado', NO_SHOW: 'No asistió',
};

export function assertTransition(from: string, to: string) {
  if (!(to in TRANSITIONS)) throw new BadRequestException(`Estado inválido: ${to}`);
  if (from === to) return;
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(`No se puede pasar de "${STATUS_LABELS[from] ?? from}" a "${STATUS_LABELS[to] ?? to}"`);
  }
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * RN-03 + reglas de agenda: no se permite solapar en el mismo sillón físico (aunque los odontólogos sean distintos),
 * ni el mismo odontólogo, ni el mismo paciente. Se usa en crear, editar, reactivar y en la aprobación de presupuestos.
 */
export async function assertNoConflicts(
  prisma: any,
  p: { clinicId: string; startAt: Date; endAt: Date; dentistId?: string | null; roomId?: string | null; patientId?: string | null; excludeId?: string },
) {
  if (!(p.endAt > p.startAt)) throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
  const base: any = {
    clinicId: p.clinicId,
    status: { in: ['SCHEDULED', 'CONFIRMED', 'WAITING', 'IN_PROGRESS'] },
    startAt: { lt: p.endAt },
    endAt: { gt: p.startAt },
  };
  if (p.excludeId) base.id = { not: p.excludeId };

  const checks: [string, any, string][] = [];
  if (p.roomId) checks.push(['roomId', p.roomId, 'El sillón/consultorio ya está ocupado en ese horario (RN-03)']);
  if (p.dentistId) checks.push(['dentistId', p.dentistId, 'El odontólogo ya tiene una cita en ese horario']);
  if (p.patientId) checks.push(['patientId', p.patientId, 'El paciente ya tiene otra cita en ese horario']);

  for (const [field, value, message] of checks) {
    const hit = await prisma.appointment.findFirst({
      where: { ...base, [field]: value },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    if (hit) {
      const t = (d: Date) => d.toISOString();
      throw new ConflictException({
        statusCode: 409,
        message,
        conflict: { id: hit.id, startAt: t(hit.startAt), endAt: t(hit.endAt), patient: hit.patient ? `${hit.patient.firstName} ${hit.patient.lastName}` : undefined },
      });
    }
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { allergyConflicts } from './allergy-check';

type RxItem = { medication: string; dose?: string; frequency?: string; duration?: string; notes?: string };

@Injectable()
export class PrescriptionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    clinicId: string,
    data: { patientId: string; diagnosis?: string; indications?: string; items: RxItem[]; appointmentId?: string; overrideAllergy?: boolean },
    dentistId?: string,
  ) {
    const patient = await this.prisma.patient.findFirst({ where: { id: data.patientId, clinicId }, include: { medicalHistory: true } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    const items = (data.items || []).filter((i) => i.medication?.trim());
    if (!items.length) throw new BadRequestException('La receta debe tener al menos un medicamento');

    // RF-02: bloquear recetas que choquen con alergias registradas, salvo confirmación explícita del profesional
    const conflicts = allergyConflicts(patient.medicalHistory?.allergies ?? [], items.map((i) => i.medication));
    if (conflicts.length && !data.overrideAllergy) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ALLERGY_CONFLICT',
        message: `Alerta de alergia: ${conflicts.map((c) => `${c.medication} (alergia a ${c.allergy})`).join('; ')}`,
        conflicts,
      });
    }

    return this.prisma.prescription.create({
      data: {
        clinicId,
        patientId: data.patientId,
        dentistId,
        appointmentId: data.appointmentId,
        diagnosis: data.diagnosis,
        indications: [data.indications, conflicts.length ? `[Prescrito pese a alergia registrada: ${conflicts.map((c) => c.allergy).join(', ')}]` : null].filter(Boolean).join('\n') || null,
        items,
      },
    });
  }

  async listByPatient(clinicId: string, patientId: string) {
    const list = await this.prisma.prescription.findMany({ where: { clinicId, patientId }, orderBy: { createdAt: 'desc' } });
    const ids = [...new Set(list.map((r) => r.dentistId).filter(Boolean))] as string[];
    const dentists = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, specialties: true } });
    const byId = new Map(dentists.map((d) => [d.id, d]));
    return list.map((r) => ({ ...r, dentist: r.dentistId ? byId.get(r.dentistId) ?? null : null }));
  }

  async sign(clinicId: string, id: string, userId?: string) {
    const rx = await this.prisma.prescription.findFirst({ where: { id, clinicId } });
    if (!rx) throw new NotFoundException('Receta no encontrada');
    if (rx.isSigned) throw new ForbiddenException('La receta ya está firmada');
    if (rx.dentistId && rx.dentistId !== userId) throw new ForbiddenException('Solo el profesional que prescribe puede firmar la receta');
    return this.prisma.prescription.update({ where: { id }, data: { isSigned: true, signedAt: new Date() } });
  }
}

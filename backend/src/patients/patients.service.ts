import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto, MedicalHistoryDto, GuardianDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { ageFrom, computeAlerts, isValidCedula } from './medical-alerts';

const MEDICAL_KEYS = [
  'allergies', 'medications', 'systemicDiseases', 'surgicalHistory', 'habits', 'anticoagulated',
  'bleedingDisorder', 'isPregnant', 'pregnancyWeeks', 'bloodType', 'alerts',
] as const;
const GUARDIAN_KEYS = ['guardianName', 'guardianDocument', 'guardianRelationship', 'guardianPhone'] as const;

function pickMedical(dto: any): MedicalHistoryDto {
  const out: any = {};
  for (const k of MEDICAL_KEYS) if (dto[k] !== undefined) out[k] = dto[k];
  return out;
}
function stripKeys(dto: any) {
  const out: any = { ...dto };
  for (const k of [...MEDICAL_KEYS, ...GUARDIAN_KEYS]) delete out[k];
  return out;
}

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  /** RF-01: ficha única. RF-02: la anamnesis se crea siempre (registro obligatorio) y genera alertas. */
  async create(clinicId: string, dto: CreatePatientDto, createdById?: string) {
    if ((dto.documentType || 'CEDULA') === 'CEDULA' && !isValidCedula(dto.documentNumber)) {
      throw new BadRequestException('Número de cédula inválido');
    }
    const existing = await this.prisma.patient.findUnique({
      where: { clinicId_documentNumber: { clinicId, documentNumber: dto.documentNumber } },
    });
    if (existing) {
      throw new ConflictException('Ya existe un paciente con ese número de documento en esta clínica');
    }

    const age = ageFrom(dto.birthDate);
    if (age !== null && age < 18 && !dto.guardianName) {
      throw new BadRequestException('El paciente es menor de edad: registre a su representante legal (RF-01)');
    }

    const medical = pickMedical(dto);
    const base = stripKeys(dto);

    return this.prisma.patient.create({
      data: {
        ...base,
        clinicId,
        documentType: dto.documentType || 'CEDULA',
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        tags: dto.tags || [],
        createdById,
        medicalHistory: {
          create: {
            allergies: medical.allergies || [],
            medications: medical.medications || [],
            systemicDiseases: medical.systemicDiseases || [],
            surgicalHistory: medical.surgicalHistory || [],
            habits: medical.habits || [],
            anticoagulated: medical.anticoagulated ?? false,
            bleedingDisorder: medical.bleedingDisorder ?? false,
            isPregnant: medical.isPregnant ?? false,
            pregnancyWeeks: medical.pregnancyWeeks ?? null,
            bloodType: medical.bloodType,
            alerts: computeAlerts(medical),
            reviewedAt: new Date(),
            reviewedById: createdById,
          },
        },
        guardians: dto.guardianName
          ? {
              create: {
                fullName: dto.guardianName,
                documentNumber: dto.guardianDocument || null,
                relationship: dto.guardianRelationship || 'Representante legal',
                phone: dto.guardianPhone || null,
              },
            }
          : undefined,
      },
      include: { medicalHistory: true, guardians: true },
    });
  }

  async findAll(clinicId: string, search?: string, page = 1, limit = 20, includeInactive = false) {
    const where: any = { clinicId };
    if (!includeInactive) where.isActive = true;
    if (search) {
      const terms = search.trim().split(/\s+/);
      where.AND = terms.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: 'insensitive' } },
          { lastName: { contains: t, mode: 'insensitive' } },
          { documentNumber: { contains: t } },
          { phone: { contains: t } },
          { email: { contains: t, mode: 'insensitive' } },
        ],
      }));
    }
    limit = Math.min(Math.max(limit, 1), 500);

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        include: { medicalHistory: { select: { alerts: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(clinicId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, clinicId },
      include: {
        medicalHistory: true,
        guardians: true,
        treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 5 },
        appointments: {
          orderBy: { startAt: 'desc' },
          take: 10,
          include: { dentist: { select: { firstName: true, lastName: true } }, room: { select: { name: true } } },
        },
      },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    const [balance] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { clinicId, patientId: id, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
        _sum: { total: true, paidAmount: true },
      }),
    ]);
    return {
      ...patient,
      age: ageFrom(patient.birthDate),
      pendingBalance: Number(balance._sum.total ?? 0) - Number(balance._sum.paidAmount ?? 0),
    };
  }

  async update(clinicId: string, id: string, dto: UpdatePatientDto, userId?: string) {
    const current = await this.findOne(clinicId, id);
    const medical = pickMedical(dto);
    const base = stripKeys(dto);
    const docChanged = base.documentNumber && base.documentNumber !== current.documentNumber;
    if (docChanged && (base.documentType || current.documentType) === 'CEDULA' && !isValidCedula(base.documentNumber)) {
      throw new BadRequestException('Número de cédula inválido');
    }
    const updated = await this.prisma.patient.update({
      where: { id },
      data: { ...base, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined },
    });
    if (Object.keys(medical).length) await this.updateMedicalHistory(clinicId, id, medical, userId);
    if (dto.guardianName) {
      await this.addGuardian(clinicId, id, {
        fullName: dto.guardianName,
        documentNumber: dto.guardianDocument,
        relationship: dto.guardianRelationship || 'Representante legal',
        phone: dto.guardianPhone,
      });
    }
    return { ...updated, ...(await this.findOne(clinicId, id)) };
  }

  /** RF-02: actualizar anamnesis y recalcular alertas. */
  async updateMedicalHistory(clinicId: string, patientId: string, dto: MedicalHistoryDto, userId?: string) {
    await this.prisma.patient.findFirstOrThrow({ where: { id: patientId, clinicId } }).catch(() => {
      throw new NotFoundException('Paciente no encontrado');
    });
    const current = await this.prisma.medicalHistory.findUnique({ where: { patientId } });
    const merged: any = {
      allergies: current?.allergies ?? [],
      medications: current?.medications ?? [],
      systemicDiseases: current?.systemicDiseases ?? [],
      surgicalHistory: current?.surgicalHistory ?? [],
      habits: current?.habits ?? [],
      anticoagulated: current?.anticoagulated ?? false,
      bleedingDisorder: current?.bleedingDisorder ?? false,
      isPregnant: current?.isPregnant ?? false,
      pregnancyWeeks: current?.pregnancyWeeks ?? null,
      bloodType: current?.bloodType ?? null,
      notes: current?.notes ?? null,
      ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)),
    };
    if (!merged.isPregnant) merged.pregnancyWeeks = null;
    // Si envían alertas manuales se usan como base; si no, se descartan las automáticas previas y se recalculan.
    merged.alerts = computeAlerts({ ...merged, alerts: dto.alerts ?? [] });
    const data = { ...merged, reviewedAt: new Date(), reviewedById: userId ?? null };
    return this.prisma.medicalHistory.upsert({
      where: { patientId },
      create: { patientId, ...data },
      update: data,
    });
  }

  async addGuardian(clinicId: string, patientId: string, dto: GuardianDto) {
    await this.prisma.patient.findFirstOrThrow({ where: { id: patientId, clinicId } }).catch(() => {
      throw new NotFoundException('Paciente no encontrado');
    });
    return this.prisma.guardian.create({ data: { patientId, ...dto } });
  }

  async softDelete(clinicId: string, id: string) {
    await this.findOne(clinicId, id);
    return this.prisma.patient.update({ where: { id }, data: { isActive: false } });
  }

  /** Línea de tiempo del expediente (RF-05 bitácora cronológica + resto de eventos clínicos). */
  async timeline(clinicId: string, patientId: string) {
    await this.prisma.patient.findFirstOrThrow({ where: { id: patientId, clinicId } }).catch(() => {
      throw new NotFoundException('Paciente no encontrado');
    });
    const [appts, notes, rx, consents, odontos, invoices] = await Promise.all([
      this.prisma.appointment.findMany({ where: { clinicId, patientId }, include: { dentist: { select: { firstName: true, lastName: true } } } }),
      this.prisma.clinicalNote.findMany({ where: { clinicId, patientId }, include: { author: { select: { firstName: true, lastName: true } } } }),
      this.prisma.prescription.findMany({ where: { clinicId, patientId } }),
      this.prisma.consent.findMany({ where: { clinicId, patientId } }),
      this.prisma.odontogram.findMany({ where: { clinicId, patientId }, select: { id: true, version: true, createdAt: true } }),
      this.prisma.invoice.findMany({ where: { clinicId, patientId }, select: { id: true, number: true, total: true, status: true, createdAt: true } }),
    ]);
    const L: Record<string, string> = {
      SCHEDULED: 'Programada', CONFIRMED: 'Confirmada', WAITING: 'En sala de espera', IN_PROGRESS: 'En atención', COMPLETED: 'Atendida',
      CANCELLED: 'Cancelada', NO_SHOW: 'No asistió', DRAFT: 'Borrador', ISSUED: 'Emitida', PARTIALLY_PAID: 'Abonada', PAID: 'Pagada',
      PENDING: 'Pendiente de firma', SIGNED: 'Firmado', REVOKED: 'Revocado', CREDIT_NOTE: 'Nota de crédito',
    };
    const st = (x: string) => L[x] ?? x;
    const events = [
      ...appts.map((a) => ({ type: 'APPOINTMENT', date: a.startAt, title: a.reason || 'Cita', detail: `${st(a.status)} · Dr(a). ${a.dentist.firstName} ${a.dentist.lastName}`, id: a.id })),
      ...notes.map((n) => ({ type: n.noteType === 'ADDENDUM' ? 'ADDENDUM' : 'NOTE', date: n.createdAt, title: n.noteType === 'ADDENDUM' ? 'Adenda' : 'Nota de evolución', detail: `${n.author.firstName} ${n.author.lastName}${n.isLocked ? ' · firmada' : ''}`, id: n.id })),
      ...rx.map((r) => ({ type: 'PRESCRIPTION', date: r.createdAt, title: 'Receta', detail: r.diagnosis || '', id: r.id })),
      ...consents.map((c) => ({ type: 'CONSENT', date: c.signedAt || c.createdAt, title: c.title, detail: st(c.status), id: c.id })),
      ...odontos.map((o) => ({ type: 'ODONTOGRAM', date: o.createdAt, title: `Odontograma v${o.version}`, detail: '', id: o.id })),
      ...invoices.map((i) => ({ type: 'INVOICE', date: i.createdAt, title: `Factura ${i.number || '(borrador)'}`, detail: `$${Number(i.total).toFixed(2)} · ${st(i.status)}`, id: i.id })),
    ];
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOdontogramDto, UpdateToothDto } from './dto/create-odontogram.dto';

const VALID_TEETH = new Set<number>([
  ...[1, 2, 3, 4].flatMap((q) => Array.from({ length: 8 }, (_, i) => q * 10 + i + 1)),
  ...[5, 6, 7, 8].flatMap((q) => Array.from({ length: 5 }, (_, i) => q * 10 + i + 1)),
]);

type ToothInput = { toothNumber: number; surface?: string | null; condition: string; status?: string; notes?: string; procedureId?: string };

const keyOf = (t: { toothNumber: number; surface?: string | null; condition: string }) => `${t.toothNumber}|${t.surface ?? ''}|${t.condition}`;

/**
 * RN-01: lo registrado como "Realizado" (DONE) nunca se pierde. Cada guardado crea una versión nueva
 * (las anteriores quedan intactas en la base y protegidas por trigger), y los registros DONE de la versión previa
 * se arrastran automáticamente aunque el cliente no los envíe.
 */
export function mergeWithDone(previous: ToothInput[], incoming: ToothInput[]) {
  const result = new Map<string, ToothInput>();
  for (const t of incoming) {
    if (!VALID_TEETH.has(t.toothNumber)) throw new BadRequestException(`Diente ${t.toothNumber} no válido en notación FDI`);
    result.set(keyOf(t), { ...t, surface: t.surface ?? null });
  }
  for (const p of previous) {
    if (p.status !== 'DONE') continue;
    const k = keyOf(p);
    if (!result.has(k)) result.set(k, { ...p, notes: p.notes ?? undefined });
    else result.set(k, { ...result.get(k)!, status: 'DONE' }); // un realizado no puede volver a pendiente
  }
  return [...result.values()];
}

@Injectable()
export class OdontogramService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreateOdontogramDto, createdById?: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');

    const last = await this.prisma.odontogram.findFirst({
      where: { patientId: dto.patientId, clinicId },
      orderBy: { version: 'desc' },
      include: { teeth: true },
    });
    const teeth = mergeWithDone((last?.teeth ?? []) as any, dto.teeth as any);

    return this.prisma.odontogram.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        version: (last?.version ?? 0) + 1,
        notes: dto.notes,
        createdById,
        teeth: {
          create: teeth.map((t) => ({
            toothNumber: t.toothNumber,
            surface: (t.surface || null) as any,
            condition: t.condition as any,
            status: (t.status || 'PENDING') as any,
            notes: t.notes,
            procedureId: t.procedureId,
          })),
        },
      },
      include: { teeth: true },
    });
  }

  async getLatest(clinicId: string, patientId: string) {
    const odontogram = await this.prisma.odontogram.findFirst({
      where: { clinicId, patientId },
      orderBy: { version: 'desc' },
      include: { teeth: true },
    });
    return odontogram ?? { id: null, patientId, version: 0, teeth: [], notes: null };
  }

  getHistory(clinicId: string, patientId: string) {
    return this.prisma.odontogram.findMany({
      where: { clinicId, patientId },
      orderBy: { version: 'desc' },
      include: { teeth: true },
    });
  }

  async findOne(clinicId: string, id: string) {
    const od = await this.prisma.odontogram.findFirst({ where: { id, clinicId }, include: { teeth: true } });
    if (!od) throw new NotFoundException('Odontograma no encontrado');
    return od;
  }

  /** Cambia un diente generando una nueva versión (no se edita la versión anterior). */
  async upsertTooth(clinicId: string, patientId: string, toothNumber: number, dto: UpdateToothDto, createdById?: string) {
    const latest: any = await this.getLatest(clinicId, patientId);
    const surface = dto.surface || null;
    const current = (latest.teeth as any[]).filter((t) => !(t.toothNumber === toothNumber && (t.surface ?? null) === surface && t.status !== 'DONE'));
    const lockedSame = (latest.teeth as any[]).find((t) => t.toothNumber === toothNumber && (t.surface ?? null) === surface && t.status === 'DONE' && t.condition === (dto.condition || 'CARIES'));
    if (lockedSame && dto.status && dto.status !== 'DONE') {
      throw new BadRequestException('RN-01: ese procedimiento ya está registrado como Realizado y no puede revertirse. Registre una nota de adenda.');
    }
    return this.create(
      clinicId,
      {
        patientId,
        notes: `Actualización diente ${toothNumber}`,
        teeth: [
          ...current.map((t) => ({ toothNumber: t.toothNumber, surface: t.surface ?? undefined, condition: t.condition, status: t.status, notes: t.notes ?? undefined, procedureId: t.procedureId ?? undefined })),
          { toothNumber, surface: surface ?? undefined, condition: (dto.condition || 'CARIES') as any, status: (dto.status || 'PENDING') as any, notes: dto.notes },
        ],
      } as any,
      createdById,
    );
  }
}

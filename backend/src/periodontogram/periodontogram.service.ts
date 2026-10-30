import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcAttachment, summarize, validateSite } from './perio-calc';

@Injectable()
export class PeriodontogramService {
  constructor(private prisma: PrismaService) {}

  async create(
    clinicId: string,
    data: {
      patientId: string;
      notes?: string;
      sites: {
        toothNumber: number;
        probingDepths: number[];
        gingivalMargin?: number[];
        clinicalAttachment?: number[];
        bleeding?: boolean[];
        mobility?: number;
        furcation?: number;
        notes?: string;
      }[];
    },
    userId?: string,
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: data.patientId, clinicId },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (!data.sites?.length) throw new BadRequestException('Registre al menos un diente');
    for (const site of data.sites) {
      const err = validateSite(site);
      if (err) throw new BadRequestException(err);
    }

    const last = await this.prisma.periodontogram.findFirst({
      where: { patientId: data.patientId },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;

    return this.prisma.periodontogram.create({
      data: {
        clinicId,
        patientId: data.patientId,
        version,
        notes: data.notes,
        createdById: userId,
        sites: {
          create: data.sites.map((s) => ({
            toothNumber: s.toothNumber,
            probingDepths: s.probingDepths || [],
            gingivalMargin: s.gingivalMargin || [],
            // RF-04: el NIC siempre lo calcula el servidor (PS + MG)
            clinicalAttachment: calcAttachment(s.probingDepths || [], s.gingivalMargin || []),
            bleeding: s.bleeding?.length === 6 ? s.bleeding : [false, false, false, false, false, false],
            mobility: s.mobility,
            furcation: s.furcation,
            notes: s.notes,
          })),
        },
      },
      include: { sites: true },
    });
  }

  async getLatest(clinicId: string, patientId: string) {
    const p = await this.prisma.periodontogram.findFirst({
      where: { clinicId, patientId },
      orderBy: { version: 'desc' },
      include: { sites: { orderBy: { toothNumber: 'asc' } } },
    });
    return p ? { ...p, summary: summarize(p.sites) } : null;
  }

  async getHistory(clinicId: string, patientId: string) {
    const list = await this.prisma.periodontogram.findMany({
      where: { clinicId, patientId },
      orderBy: { version: 'desc' },
      include: { sites: true },
    });
    return list.map((p) => ({ id: p.id, version: p.version, createdAt: p.createdAt, notes: p.notes, summary: summarize(p.sites) }));
  }
}

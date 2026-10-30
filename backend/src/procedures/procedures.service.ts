import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';

@Injectable()
export class ProceduresService {
  constructor(private prisma: PrismaService) {}

  create(clinicId: string, dto: CreateProcedureDto) {
    return this.prisma.procedure.create({
      data: {
        clinicId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        price: dto.price,
        labCost: dto.labCost ?? 0,
        durationMin: dto.durationMin,
        isActive: dto.isActive ?? true,
      },
    });
  }

  findAll(clinicId: string, category?: string) {
    const where: any = { clinicId, isActive: true };
    if (category) where.category = category;
    return this.prisma.procedure.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(clinicId: string, id: string) {
    const proc = await this.prisma.procedure.findFirst({ where: { id, clinicId } });
    if (!proc) throw new NotFoundException('Procedimiento no encontrado');
    return proc;
  }

  async update(clinicId: string, id: string, dto: UpdateProcedureDto) {
    await this.findOne(clinicId, id);
    return this.prisma.procedure.update({ where: { id }, data: dto });
  }

  async remove(clinicId: string, id: string) {
    await this.findOne(clinicId, id);
    return this.prisma.procedure.update({ where: { id }, data: { isActive: false } });
  }

  /** Seed idempotente: no duplica si ya existe el mismo nombre en la clínica */
  async seedDefaults(clinicId: string) {
    const defaults = [
      { name: 'Consulta / Evaluación', category: 'General', price: 20, durationMin: 30 },
      { name: 'Limpieza dental (profilaxis)', category: 'Preventiva', price: 35, durationMin: 45 },
      { name: 'Obturación simple (1 superficie)', category: 'Operatoria', price: 40, durationMin: 40 },
      { name: 'Obturación compuesta (2-3 superficies)', category: 'Operatoria', price: 55, durationMin: 50 },
      { name: 'Extracción simple', category: 'Cirugía', price: 50, durationMin: 30 },
      { name: 'Extracción quirúrgica', category: 'Cirugía', price: 90, durationMin: 60 },
      { name: 'Endodoncia unirradicular', category: 'Endodoncia', price: 120, durationMin: 90 },
      { name: 'Endodoncia multirradicular', category: 'Endodoncia', price: 180, durationMin: 120 },
      { name: 'Corona de porcelana', category: 'Prótesis', price: 280, durationMin: 60 },
      { name: 'Implante dental', category: 'Implantología', price: 800, durationMin: 90 },
      { name: 'Radiografía periapical', category: 'Diagnóstico', price: 10, durationMin: 10 },
      { name: 'Radiografía panorámica', category: 'Diagnóstico', price: 25, durationMin: 15 },
      { name: 'Blanqueamiento dental', category: 'Estética', price: 150, durationMin: 60 },
      { name: 'Sellantes de fosas y fisuras', category: 'Preventiva', price: 25, durationMin: 20 },
      { name: 'Prótesis parcial removible', category: 'Prótesis', price: 350, durationMin: 45 },
    ];

    const existing = await this.prisma.procedure.findMany({
      where: { clinicId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

    const created: any[] = [];
    const skipped: string[] = [];

    for (const d of defaults) {
      if (existingNames.has(d.name.toLowerCase())) {
        skipped.push(d.name);
        continue;
      }
      const p = await this.prisma.procedure.create({ data: { clinicId, ...d } });
      created.push(p);
    }

    return {
      message:
        created.length === 0
          ? 'El catálogo ya estaba cargado. No se duplicó ningún procedimiento.'
          : `Se agregaron ${created.length} procedimiento(s). ${skipped.length} ya existían.`,
      created: created.length,
      skipped: skipped.length,
      items: created,
    };
  }

  /** Desactiva procedimientos duplicados (deja el más antiguo activo) */
  async cleanupDuplicates(clinicId: string) {
    const all = await this.prisma.procedure.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Map<string, string>();
    const toDisable: string[] = [];

    for (const p of all) {
      const key = p.name.toLowerCase();
      if (seen.has(key)) {
        toDisable.push(p.id);
      } else {
        seen.set(key, p.id);
      }
    }

    if (toDisable.length) {
      await this.prisma.procedure.updateMany({
        where: { id: { in: toDisable } },
        data: { isActive: false },
      });
    }

    return {
      message: `Se desactivaron ${toDisable.length} procedimiento(s) duplicado(s).`,
      disabled: toDisable.length,
    };
  }
}

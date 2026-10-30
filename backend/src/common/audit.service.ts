import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rangeBounds } from './time';

const SENSITIVE = /password|passwordHash|twoFactorSecret|signatureData|otp|code|token/i;

/** Quita datos sensibles y recorta el tamaño antes de guardarlos en el log. */
export function sanitize(data: any, depth = 0): any {
  if (data == null || depth > 3) return data;
  if (Array.isArray(data)) return data.slice(0, 50).map((d) => sanitize(d, depth + 1));
  if (typeof data === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (SENSITIVE.test(k)) out[k] = '[REDACTED]';
      else if (typeof v === 'string' && v.length > 500) out[k] = v.slice(0, 500) + '…';
      else out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return data;
}

/**
 * RNF-06: log de auditoría. La tabla audit_logs es inmutable a nivel de base de datos
 * (trigger que bloquea UPDATE/DELETE, ver prisma/immutability.sql).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(private prisma: PrismaService) {}

  async log(params: {
    clinicId?: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          clinicId: params.clinicId,
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          oldData: params.oldData != null ? sanitize(params.oldData) : undefined,
          newData: params.newData != null ? sanitize(params.newData) : undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent?.slice(0, 300),
        },
      });
    } catch (e: any) {
      // No bloquear la operación clínica por un fallo de auditoría, pero dejar rastro en consola.
      this.logger.error(`No se pudo registrar auditoría: ${e?.message}`);
    }
  }

  list(clinicId: string, f: { userId?: string; entity?: string; action?: string; from?: string; to?: string; entityId?: string; page?: number; limit?: number }) {
    const where: any = { clinicId };
    if (f.userId) where.userId = f.userId;
    if (f.entity) where.entity = f.entity;
    if (f.entityId) where.entityId = f.entityId;
    if (f.action) where.action = f.action;
    if (f.from || f.to) {
      const { start, end } = rangeBounds(f.from, f.to);
      where.createdAt = { gte: start, lte: end };
    }
    const limit = Math.min(f.limit || 50, 200);
    const page = Math.max(f.page || 1, 1);
    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }));
  }
}

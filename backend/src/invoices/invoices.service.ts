import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { readSettings } from '../common/clinic-settings';
import { dayBounds, CLINIC_OFFSET_H } from '../common/time';
import { accessKey, buildInvoiceXml, buyerIdType } from './sri';

const r2 = (v: number) => Math.round(v * 100) / 100;
const METHODS = ['CASH', 'CARD', 'TRANSFER', 'CHECK', 'INSURANCE', 'OTHER'];

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, data: { patientId: string; items: { description: string; quantity: number; unitPrice: number }[]; notes?: string; issue?: boolean }) {
    const patient = await this.prisma.patient.findFirst({ where: { id: data.patientId, clinicId } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (!data.items?.length) throw new BadRequestException('Debe incluir ítems');

    let subtotal = 0;
    const itemsData = data.items.map((i) => {
      const total = r2(i.quantity * i.unitPrice);
      subtotal += total;
      return { description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total };
    });
    subtotal = r2(subtotal);
    // Servicios de salud: IVA 0% (Ley de Régimen Tributario Interno, art. 56)
    const invoice = await this.prisma.invoice.create({
      data: { clinicId, patientId: data.patientId, status: 'DRAFT', subtotal, tax: 0, total: subtotal, notes: data.notes, items: { create: itemsData } },
      include: { items: true, patient: { select: { firstName: true, lastName: true } } },
    });
    return data.issue ? this.issue(clinicId, invoice.id) : invoice;
  }

  findAll(clinicId: string, f: { patientId?: string; status?: string; from?: string; to?: string } = {}) {
    const where: any = { clinicId };
    if (f.patientId) where.patientId = f.patientId;
    if (f.status) where.status = { in: f.status.split(',') };
    if (f.from || f.to) {
      where.createdAt = {};
      if (f.from) where.createdAt.gte = dayBounds(f.from).start;
      if (f.to) where.createdAt.lte = dayBounds(f.to).end;
    }
    return this.prisma.invoice.findMany({
      where,
      include: { items: true, payments: true, patient: { select: { id: true, firstName: true, lastName: true, documentNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async findOne(clinicId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, clinicId }, include: { items: true, payments: true, patient: true } });
    if (!inv) throw new NotFoundException('Factura no encontrada');
    return inv;
  }

  /** RF-12: emisión con numeración SRI (estab-ptoEmi-secuencial) y clave de acceso de 49 dígitos. */
  async issue(clinicId: string, id: string) {
    const inv = await this.findOne(clinicId, id);
    if (inv.status !== 'DRAFT') throw new BadRequestException('Solo se pueden emitir borradores');
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    const sri = readSettings(clinic?.settings).sri;
    const prefix = `${sri.establecimiento}-${sri.puntoEmision}-`;
    const last = await this.prisma.invoice.findFirst({
      where: { clinicId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = (last?.number ? Number(last.number.slice(prefix.length)) : 0) + 1;
    const number = `${prefix}${String(seq).padStart(9, '0')}`;
    const issuedAt = new Date();
    const key = clinic?.ruc
      ? accessKey({ date: issuedAt, ruc: clinic.ruc, ambiente: sri.ambiente, establecimiento: sri.establecimiento, puntoEmision: sri.puntoEmision, secuencial: seq, numericCode: String(randomInt(0, 1e8)), offsetH: CLINIC_OFFSET_H })
      : null;
    try {
      return await this.prisma.invoice.update({
        where: { id },
        data: { status: 'ISSUED', number, issuedAt, sriAccessKey: key, sriStatus: key ? 'PENDIENTE_FIRMA' : 'SIN_RUC' },
        include: { items: true, payments: true, patient: { select: { firstName: true, lastName: true } } },
      });
    } catch (e: any) {
      throw new ConflictException('Otro usuario emitió una factura al mismo tiempo; intente nuevamente');
    }
  }

  /** RF-12: pagos mixtos (efectivo, tarjeta, transferencia, seguro...). No se permite cobrar de más. */
  async addPayment(clinicId: string, invoiceId: string, data: { amount: number; method: string; reference?: string; notes?: string }) {
    const inv = await this.findOne(clinicId, invoiceId);
    if (!['ISSUED', 'PARTIALLY_PAID'].includes(inv.status)) throw new BadRequestException('Solo se cobran facturas emitidas con saldo');
    if (!METHODS.includes(data.method)) throw new BadRequestException('Método de pago inválido');
    if (['CARD', 'TRANSFER', 'INSURANCE', 'CHECK'].includes(data.method) && !data.reference) {
      throw new BadRequestException('Ingrese la referencia (voucher, número de transferencia, póliza o cheque)');
    }
    const amount = r2(Number(data.amount));
    const balance = r2(Number(inv.total) - Number(inv.paidAmount));
    if (amount <= 0) throw new BadRequestException('Monto inválido');
    if (amount > balance + 0.001) throw new BadRequestException(`El monto supera el saldo pendiente ($${balance.toFixed(2)})`);

    const paidAmount = r2(Number(inv.paidAmount) + amount);
    const status = paidAmount >= Number(inv.total) - 0.001 ? 'PAID' : 'PARTIALLY_PAID';
    await this.prisma.$transaction([
      this.prisma.payment.create({ data: { invoiceId, amount, method: data.method as any, reference: data.reference, notes: data.notes } }),
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status } }),
    ]);
    return this.findOne(clinicId, invoiceId);
  }

  /** Anular: solo facturas sin pagos (con pagos corresponde nota de crédito). */
  async cancel(clinicId: string, id: string, reason: string) {
    const inv = await this.findOne(clinicId, id);
    if (inv.status === 'CANCELLED') return inv;
    if (inv.payments.length) throw new BadRequestException('La factura tiene pagos: emita una nota de crédito');
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED', notes: [inv.notes, `ANULADA: ${reason}`].filter(Boolean).join('\n') },
    });
  }

  /** RF-12: XML del comprobante electrónico (factura v1.1.0) listo para firmar. */
  async sriXml(clinicId: string, id: string) {
    const inv = await this.findOne(clinicId, id);
    if (!inv.number || !inv.issuedAt) throw new BadRequestException('Emita la factura antes de generar el XML');
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic?.ruc || !inv.sriAccessKey) throw new BadRequestException('Configure el RUC de la clínica y vuelva a emitir');
    const sri = readSettings(clinic.settings).sri;
    const p = inv.patient;
    return buildInvoiceXml({
      accessKey: inv.sriAccessKey,
      ambiente: sri.ambiente,
      razonSocial: clinic.legalName || clinic.name,
      nombreComercial: clinic.name,
      ruc: clinic.ruc,
      dirMatriz: clinic.address || 'S/N',
      establecimiento: sri.establecimiento,
      puntoEmision: sri.puntoEmision,
      secuencial: Number(inv.number.split('-').pop()),
      fechaEmision: inv.issuedAt,
      obligadoContabilidad: sri.obligadoContabilidad,
      buyer: { idType: buyerIdType(p.documentType, p.documentNumber), id: p.documentNumber, name: `${p.lastName} ${p.firstName}`, address: p.address ?? undefined, email: p.email ?? undefined },
      items: inv.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: Number(it.unitPrice), total: Number(it.total) })),
      payments: inv.payments.map((pg) => ({ method: pg.method, amount: Number(pg.amount) })),
      subtotal: Number(inv.subtotal),
      total: Number(inv.total),
      offsetH: CLINIC_OFFSET_H,
    });
  }

  /** Resumen del día por método de pago (teórico). Solo contador/administrador (RN-02). */
  async dailyCashClose(clinicId: string, dateStr?: string) {
    const { start, end, key } = dayBounds(dateStr);
    const payments = await this.prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end }, invoice: { clinicId } },
      include: { invoice: { select: { number: true, patient: { select: { firstName: true, lastName: true } } } } },
      orderBy: { paidAt: 'asc' },
    });
    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      byMethod[p.method] = r2((byMethod[p.method] || 0) + amt);
      total += amt;
    }
    const close = await this.prisma.cashClose.findFirst({ where: { clinicId, closeDate: { gte: start, lte: end } } });
    return {
      date: key,
      total: r2(total),
      count: payments.length,
      byMethod,
      closed: !!close,
      payments: payments.map((p) => ({
        id: p.id, amount: Number(p.amount), method: p.method, reference: p.reference, paidAt: p.paidAt,
        invoiceNumber: p.invoice?.number,
        patient: p.invoice?.patient ? `${p.invoice.patient.firstName} ${p.invoice.patient.lastName}` : null,
      })),
    };
  }

  /** Estado del cierre del día sin revelar montos (para la recepcionista antes del conteo). */
  async blindCloseStatus(clinicId: string, dateStr?: string) {
    const { start, end, key } = dayBounds(dateStr);
    const close = await this.prisma.cashClose.findFirst({ where: { clinicId, closeDate: { gte: start, lte: end } } });
    return { date: key, closed: !!close, closedAt: close?.createdAt ?? null };
  }

  /**
   * RN-02 Cierre de caja ciego: el conteo físico se registra SIN ver el teórico.
   * Solo después de guardar se revela el teórico y la diferencia. Un cierre por día.
   */
  async blindCashClose(
    clinicId: string,
    data: { date?: string; physicalCash: number; physicalCard?: number; physicalTransfer?: number; notes?: string },
    user: { userId?: string; role: string },
  ) {
    const { start, end, key } = dayBounds(data.date);
    if (start.getTime() > Date.now()) throw new BadRequestException('No se puede cerrar un día futuro');
    const existing = await this.prisma.cashClose.findFirst({ where: { clinicId, closeDate: { gte: start, lte: end } } });
    if (existing) throw new ConflictException(`La caja del ${key} ya fue cerrada`);
    if (user.role === 'RECEPTIONIST' && key !== dayBounds().key) throw new ForbiddenException('Recepción solo puede cerrar la caja del día');

    const summary = await this.dailyCashClose(clinicId, key);
    const theoreticalCash = summary.byMethod['CASH'] || 0;
    const theoreticalCard = summary.byMethod['CARD'] || 0;
    const theoreticalTransfer = r2((summary.byMethod['TRANSFER'] || 0) + (summary.byMethod['CHECK'] || 0) + (summary.byMethod['INSURANCE'] || 0) + (summary.byMethod['OTHER'] || 0));
    const physicalCash = r2(Number(data.physicalCash) || 0);
    const physicalCard = r2(Number(data.physicalCard) || 0);
    const physicalTransfer = r2(Number(data.physicalTransfer) || 0);
    const differenceCash = r2(physicalCash - theoreticalCash);

    const close = await this.prisma.cashClose.create({
      data: {
        clinicId,
        closeDate: new Date(Math.min(end.getTime(), Date.now())),
        physicalCash, physicalCard, physicalTransfer,
        theoreticalCash, theoreticalCard, theoreticalTransfer,
        differenceCash,
        notes: data.notes,
        closedById: user.userId,
      },
    });
    const diffTotal = r2(physicalCash + physicalCard + physicalTransfer - (theoreticalCash + theoreticalCard + theoreticalTransfer));
    return {
      close,
      summary: {
        theoretical: { cash: theoreticalCash, card: theoreticalCard, transfer: theoreticalTransfer, total: r2(theoreticalCash + theoreticalCard + theoreticalTransfer) },
        physical: { cash: physicalCash, card: physicalCard, transfer: physicalTransfer, total: r2(physicalCash + physicalCard + physicalTransfer) },
        difference: { cash: differenceCash, card: r2(physicalCard - theoreticalCard), transfer: r2(physicalTransfer - theoreticalTransfer), total: diffTotal },
      },
      message: differenceCash === 0 ? 'Cierre cuadrado' : differenceCash > 0 ? `Sobrante de caja: $${differenceCash.toFixed(2)}` : `Faltante de caja: $${Math.abs(differenceCash).toFixed(2)}`,
    };
  }

  async listCashCloses(clinicId: string, limit = 60) {
    const closes = await this.prisma.cashClose.findMany({ where: { clinicId }, orderBy: { closeDate: 'desc' }, take: limit });
    const users = await this.prisma.user.findMany({
      where: { id: { in: closes.map((c) => c.closedById).filter(Boolean) as string[] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const byId = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return closes.map((c) => ({ ...c, closedBy: c.closedById ? byId.get(c.closedById) ?? null : null }));
  }
}

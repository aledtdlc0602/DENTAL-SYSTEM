import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const OTP_MINUTES = 10;
const hashOtp = (consentId: string, code: string) => createHash('sha256').update(`${consentId}:${code}`).digest('hex');

/**
 * RF-06: consentimiento informado digital por procedimiento.
 * Firma por trazo en tablet/pantalla táctil (imagen PNG) y/o validación con código OTP enviado al paciente.
 */
@Injectable()
export class ConsentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  createTemplate(clinicId: string, data: { name: string; bodyHtml: string; procedureCode?: string }) {
    return this.prisma.consentTemplate.create({
      data: { clinicId, name: data.name, bodyHtml: data.bodyHtml, procedureCode: data.procedureCode },
    });
  }

  listTemplates(clinicId: string) {
    return this.prisma.consentTemplate.findMany({ where: { clinicId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async createConsent(
    clinicId: string,
    data: { patientId: string; templateId?: string; title?: string; contentSnapshot?: string },
    userId?: string,
  ) {
    const patient = await this.prisma.patient.findFirst({ where: { id: data.patientId, clinicId } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    let content = data.contentSnapshot || '';
    let title = data.title || '';
    if (data.templateId) {
      const t = await this.prisma.consentTemplate.findFirst({ where: { id: data.templateId, clinicId } });
      if (!t) throw new NotFoundException('Plantilla no encontrada');
      content = t.bodyHtml;
      title = title || t.name;
    }
    if (!content.trim()) throw new BadRequestException('El consentimiento no tiene contenido');
    // Se congela el texto con los datos del paciente: lo firmado no cambia aunque cambie la plantilla.
    const header = `<p><strong>Paciente:</strong> ${patient.firstName} ${patient.lastName} · ${patient.documentType} ${patient.documentNumber}</p>`;
    return this.prisma.consent.create({
      data: {
        clinicId,
        patientId: data.patientId,
        templateId: data.templateId,
        title: title || 'Consentimiento informado',
        contentSnapshot: header + content,
        status: 'PENDING',
        createdById: userId,
      },
    });
  }

  listByPatient(clinicId: string, patientId: string) {
    return this.prisma.consent.findMany({
      where: { clinicId, patientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, contentSnapshot: true, status: true, signedAt: true, otpVerified: true, createdAt: true, templateId: true,
        signatureData: true,
      },
    });
  }

  private async getPending(clinicId: string, id: string) {
    const c = await this.prisma.consent.findFirst({ where: { id, clinicId } });
    if (!c) throw new NotFoundException('Consentimiento no encontrado');
    if (c.status !== 'PENDING') throw new BadRequestException(`El consentimiento está ${c.status === 'SIGNED' ? 'firmado' : 'revocado'}`);
    return c;
  }

  /** Envía un código OTP de 6 dígitos al celular del paciente (o de su representante). */
  async sendOtp(clinicId: string, id: string) {
    const c = await this.getPending(clinicId, id);
    const patient = await this.prisma.patient.findFirst({ where: { id: c.patientId, clinicId }, include: { guardians: true } });
    const phone = patient?.phone || patient?.guardians?.[0]?.phone;
    if (!phone) throw new BadRequestException('El paciente no tiene teléfono registrado para recibir el código');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.consent.update({
      where: { id },
      data: { otpHash: hashOtp(id, code), otpExpiresAt: new Date(Date.now() + OTP_MINUTES * 60000) },
    });
    const sent = await this.notifications.send(clinicId, {
      patientId: c.patientId,
      channel: 'SMS',
      toAddress: phone,
      eventType: 'CONSENT_OTP',
      body: `Su código para firmar "${c.title}" es ${code}. Vence en ${OTP_MINUTES} minutos.`,
    });
    return {
      sentTo: phone.replace(/\d(?=\d{3})/g, '•'),
      expiresInMin: OTP_MINUTES,
      // Solo en desarrollo y sin proveedor real configurado se devuelve el código para poder probar.
      devCode: process.env.NODE_ENV !== 'production' && sent.provider === 'mock' ? code : undefined,
    };
  }

  async sign(clinicId: string, id: string, data: { signatureData?: string; otpCode?: string; signerName?: string }) {
    const c = await this.getPending(clinicId, id);
    const hasSignature = typeof data.signatureData === 'string' && data.signatureData.startsWith('data:image/png;base64,');
    if (data.signatureData && !hasSignature) throw new BadRequestException('La firma debe ser una imagen PNG');
    if (hasSignature && data.signatureData!.length > 400_000) throw new BadRequestException('La imagen de la firma es demasiado grande');

    let otpVerified = false;
    if (data.otpCode) {
      if (!c.otpHash || !c.otpExpiresAt) throw new BadRequestException('Primero solicite el código OTP');
      if (c.otpExpiresAt.getTime() < Date.now()) throw new ForbiddenException('El código OTP expiró, solicite uno nuevo');
      if (hashOtp(id, data.otpCode) !== c.otpHash) throw new ForbiddenException('Código OTP incorrecto');
      otpVerified = true;
    }
    if (!hasSignature && !otpVerified) {
      throw new BadRequestException('Se requiere la firma en pantalla o el código OTP (RF-06)');
    }
    return this.prisma.consent.update({
      where: { id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData: hasSignature ? data.signatureData : `otp:${createHash('sha256').update(`${id}:${Date.now()}`).digest('hex')}`,
        otpVerified,
        otpHash: null,
        otpExpiresAt: null,
      },
    });
  }

  async revoke(clinicId: string, id: string) {
    const c = await this.prisma.consent.findFirst({ where: { id, clinicId } });
    if (!c) throw new NotFoundException('Consentimiento no encontrado');
    if (c.status === 'REVOKED') return c;
    return this.prisma.consent.update({ where: { id }, data: { status: 'REVOKED' } });
  }
}

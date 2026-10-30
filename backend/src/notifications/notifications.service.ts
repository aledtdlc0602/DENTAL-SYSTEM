import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Channel, deliver, formatDateTime, isWithinSendingHours, reminderDue, render } from './providers';

const DEFAULT_TEXT: Record<string, string> = {
  CONFIRMATION: 'Hola {{nombre}}, su cita en {{clinica}} quedó agendada para el {{fecha}} a las {{hora}} con {{doctor}}.',
  RESCHEDULED: 'Hola {{nombre}}, su cita en {{clinica}} fue reprogramada para el {{fecha}} a las {{hora}}.',
  REMINDER_48H: 'Hola {{nombre}}, le recordamos su cita en {{clinica}} el {{fecha}} a las {{hora}} con {{doctor}}. ¿Nos confirma su asistencia?',
  REMINDER_24H: 'Hola {{nombre}}, mañana {{fecha}} a las {{hora}} tiene cita en {{clinica}}. Responda SÍ para confirmar.',
  NO_SHOW_FOLLOWUP: 'Hola {{nombre}}, no pudimos atenderle hoy en {{clinica}}. ¿Desea reagendar su cita?',
};

/**
 * RF-11: notificaciones transaccionales (confirmación, recordatorios 48 h y 24 h, reprogramación, inasistencia).
 * Un planificador interno revisa la agenda cada 10 minutos y envía los recordatorios pendientes, sin duplicar.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Notifications');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NOTIFICATIONS_SCHEDULER === 'off' || process.env.NODE_ENV === 'test') return;
    const minutes = Number(process.env.NOTIFICATIONS_INTERVAL_MIN || 10);
    this.timer = setInterval(() => this.runReminders().catch((e) => this.logger.error(e?.message)), minutes * 60000);
    setTimeout(() => this.runReminders().catch((e) => this.logger.error(e?.message)), 15000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Envía un mensaje por el gateway configurado y deja registro en notification_logs. */
  async send(
    clinicId: string,
    data: { patientId?: string; channel: Channel; toAddress: string; body: string; eventType?: string; appointmentId?: string; subject?: string },
  ) {
    const result = await deliver(data.channel, data.toAddress, data.body, data.subject);
    const log = await this.prisma.notificationLog.create({
      data: {
        clinicId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        eventType: data.eventType,
        channel: data.channel,
        toAddress: data.toAddress,
        body: data.body,
        status: result.ok ? 'SENT' : 'FAILED',
        error: result.ok ? (result.provider === 'mock' ? '[MOCK] sin credenciales del proveedor' : null) : result.error,
        sentAt: result.ok ? new Date() : null,
      },
    });
    return { ...log, provider: result.provider };
  }

  /** Mensaje relacionado a una cita usando la plantilla de la clínica (si existe) o un texto por defecto. */
  async notifyAppointment(clinicId: string, appointmentId: string, eventType: string, channels?: Channel[]) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      include: { patient: { include: { guardians: true } }, dentist: true, clinic: true },
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    const { fecha, hora } = formatDateTime(appt.startAt);
    const vars = {
      nombre: appt.patient.firstName,
      fecha,
      hora,
      doctor: `Dr(a). ${appt.dentist.firstName} ${appt.dentist.lastName}`,
      clinica: appt.clinic.name,
    };
    const phone = appt.patient.phone || appt.patient.guardians?.[0]?.phone;
    const email = appt.patient.email || appt.patient.guardians?.[0]?.email;
    const wanted: Channel[] = channels ?? ['WHATSAPP', 'EMAIL'];
    const templates = await this.prisma.messageTemplate.findMany({ where: { clinicId, eventType, isActive: true } });
    const already = await this.prisma.notificationLog.findMany({ where: { appointmentId, eventType, status: 'SENT' }, select: { channel: true } });
    const sentChannels = new Set(already.map((a) => a.channel));

    const results = [];
    for (const channel of wanted) {
      if (sentChannels.has(channel)) continue;
      const to = channel === 'EMAIL' ? email : phone;
      if (!to) continue;
      const tpl = templates.find((t) => t.channel === channel);
      const body = render(tpl?.body || DEFAULT_TEXT[eventType] || DEFAULT_TEXT.CONFIRMATION, vars);
      results.push(
        await this.send(clinicId, {
          patientId: appt.patientId, appointmentId, eventType, channel, toAddress: to, body,
          subject: tpl?.subject ? render(tpl.subject, vars) : `Su cita en ${appt.clinic.name}`,
        }),
      );
    }
    return results;
  }

  /** RF-11: revisa la agenda y envía recordatorios de 48 h y 24 h que falten. */
  async runReminders(now = new Date(), clinicId?: string) {
    if (this.running) return { skipped: 'en ejecución' };
    if (!clinicId && !isWithinSendingHours(now)) return { skipped: 'fuera de horario' };
    this.running = true;
    try {
      const upcoming = await this.prisma.appointment.findMany({
        where: {
          ...(clinicId ? { clinicId } : {}),
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          startAt: { gt: now, lte: new Date(now.getTime() + 48 * 3600000) },
        },
        select: { id: true, clinicId: true, startAt: true },
        take: 1000,
      });
      if (!upcoming.length) return { sent: 0 };
      const logs = await this.prisma.notificationLog.findMany({
        where: { appointmentId: { in: upcoming.map((a) => a.id) }, eventType: { in: ['REMINDER_48H', 'REMINDER_24H'] }, status: 'SENT' },
        select: { appointmentId: true, eventType: true },
      });
      const sentBy = new Map<string, Set<string>>();
      for (const l of logs) {
        if (!sentBy.has(l.appointmentId!)) sentBy.set(l.appointmentId!, new Set());
        sentBy.get(l.appointmentId!)!.add(l.eventType!);
      }
      let sent = 0;
      for (const a of upcoming) {
        const due = reminderDue(a.startAt, now, sentBy.get(a.id) ?? new Set());
        if (!due) continue;
        const r = await this.notifyAppointment(a.clinicId, a.id, due).catch((e) => {
          this.logger.warn(`Recordatorio ${due} de ${a.id}: ${e?.message}`);
          return [];
        });
        sent += r.length;
      }
      if (sent) this.logger.log(`Recordatorios enviados: ${sent}`);
      return { sent, checked: upcoming.length };
    } finally {
      this.running = false;
    }
  }

  findLogs(clinicId: string, f: { limit?: number; status?: string; channel?: string; patientId?: string } = {}) {
    return this.prisma.notificationLog.findMany({
      where: {
        clinicId,
        ...(f.status ? { status: f.status } : {}),
        ...(f.channel ? { channel: f.channel } : {}),
        ...(f.patientId ? { patientId: f.patientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(f.limit || 100, 500),
    });
  }

  listTemplates(clinicId: string) {
    return this.prisma.messageTemplate.findMany({ where: { clinicId }, orderBy: [{ eventType: 'asc' }, { channel: 'asc' }] });
  }

  async upsertTemplate(clinicId: string, data: { channel: string; eventType: string; subject?: string; body: string; isActive?: boolean }) {
    const existing = await this.prisma.messageTemplate.findFirst({ where: { clinicId, channel: data.channel, eventType: data.eventType } });
    if (existing) return this.prisma.messageTemplate.update({ where: { id: existing.id }, data });
    return this.prisma.messageTemplate.create({ data: { clinicId, ...data } });
  }
}

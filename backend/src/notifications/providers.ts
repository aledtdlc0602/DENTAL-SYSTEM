/**
 * RF-11 / Sección 7.1: gateways de mensajería.
 * - WhatsApp: Meta Cloud API (WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
 * - SMS: Twilio (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM)
 * - Email: Twilio SendGrid (SENDGRID_API_KEY + SENDGRID_FROM)
 * Si faltan las credenciales se usa el proveedor "mock" (registra el mensaje como enviado sin salir a internet).
 */
export type Channel = 'WHATSAPP' | 'SMS' | 'EMAIL';
export interface SendResult { ok: boolean; provider: string; error?: string; externalId?: string }

/** Normaliza celulares de Ecuador a E.164 (+593...). */
export function toE164(phone: string, defaultCountry = '593') {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('0')) return `+${defaultCountry}${digits.slice(1)}`;
  if (digits.startsWith(defaultCountry)) return '+' + digits;
  return `+${defaultCountry}${digits}`;
}

export function providerFor(channel: Channel): string {
  const env = process.env;
  if (channel === 'WHATSAPP' && env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) return 'meta';
  if (channel === 'SMS' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) return 'twilio';
  if (channel === 'EMAIL' && env.SENDGRID_API_KEY && env.SENDGRID_FROM) return 'sendgrid';
  return 'mock';
}

export async function deliver(channel: Channel, to: string, body: string, subject?: string): Promise<SendResult> {
  const provider = providerFor(channel);
  const env = process.env;
  try {
    if (provider === 'meta') {
      const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: toE164(to).slice(1), type: 'text', text: { body } }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, provider, error: json?.error?.message || `HTTP ${res.status}` };
      return { ok: true, provider, externalId: json?.messages?.[0]?.id };
    }
    if (provider === 'twilio') {
      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: toE164(to), From: env.TWILIO_FROM!, Body: body }).toString(),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, provider, error: json?.message || `HTTP ${res.status}` };
      return { ok: true, provider, externalId: json?.sid };
    }
    if (provider === 'sendgrid') {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: env.SENDGRID_FROM },
          subject: subject || 'Notificación de su clínica dental',
          content: [{ type: 'text/plain', value: body }],
        }),
      });
      if (!res.ok) return { ok: false, provider, error: `HTTP ${res.status}` };
      return { ok: true, provider };
    }
    return { ok: true, provider: 'mock' };
  } catch (e: any) {
    return { ok: false, provider, error: e?.message || 'Error de red' };
  }
}

/** Reemplaza {{nombre}}, {{fecha}}, {{hora}}, {{doctor}}, {{clinica}}... */
export function render(template: string, vars: Record<string, string | undefined>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

/** Formatea fecha/hora en la zona horaria de la clínica (Ecuador por defecto). */
export function formatDateTime(d: Date, timeZone = process.env.CLINIC_TIMEZONE || 'America/Guayaquil') {
  const fecha = new Intl.DateTimeFormat('es-EC', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const hora = new Intl.DateTimeFormat('es-EC', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { fecha, hora };
}

/** Horas en las que se permite enviar recordatorios automáticos (horario clínico 07:00–21:00). */
export function isWithinSendingHours(now = new Date(), timeZone = process.env.CLINIC_TIMEZONE || 'America/Guayaquil') {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now)) % 24;
  return h >= 7 && h < 21;
}

/**
 * Decide qué recordatorio corresponde a una cita según cuánto falta (RF-11: 48 h y 24 h antes).
 * Devuelve null si no corresponde ninguno todavía.
 */
export function reminderDue(startAt: Date, now: Date, alreadySent: Set<string>): 'REMINDER_48H' | 'REMINDER_24H' | null {
  const hours = (startAt.getTime() - now.getTime()) / 3600000;
  if (hours <= 0) return null;
  if (hours <= 24) return alreadySent.has('REMINDER_24H') ? null : 'REMINDER_24H';
  if (hours <= 48) return alreadySent.has('REMINDER_48H') ? null : 'REMINDER_48H';
  return null;
}

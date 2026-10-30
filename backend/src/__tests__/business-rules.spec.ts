/**
 * Pruebas unitarias de las reglas de negocio críticas del SRS (sin base de datos).
 * Ejecutar: npm test
 */
import { totp, verifyTotp, base32Decode, base32Encode, hotp } from '../common/totp';
import { accessKey, isValidAccessKey, mod11, buildInvoiceXml, buyerIdType, paymentCode } from '../invoices/sri';
import { calcAttachment, summarize, validateSite } from '../periodontogram/perio-calc';
import { planTotals, maxDiscountFor, PLAN_TRANSITIONS } from '../treatment-plans/plan-calc';
import { pickRule, commissionFor } from '../commissions/commission-calc';
import { computeAlerts, isValidCedula, ageFrom } from '../patients/medical-alerts';
import { TRANSITIONS, overlaps } from '../appointments/scheduling';
import { reminderDue, toE164, render } from '../notifications/providers';
import { allergyConflicts } from '../prescriptions/allergy-check';
import { mergeWithDone } from '../odontogram/odontogram.service';
import { describeRequest } from '../common/audit.interceptor';
import { sanitize } from '../common/audit.service';
import { signatureHashOf } from '../clinical-notes/signature';
import { readSettings } from '../common/clinic-settings';

describe('RNF-05 MFA TOTP (RFC 6238)', () => {
  // Vector de prueba oficial RFC 6238 (SHA-1, secreto "12345678901234567890")
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it('coincide con los vectores del RFC', () => {
    expect(hotp(secret, 1)).toBe('287082');
    expect(totp(secret, 59 * 1000)).toBe('287082');
    expect(totp(secret, 1111111109 * 1000)).toBe('081804');
    expect(totp(secret, 1234567890 * 1000)).toBe('005924');
  });
  it('acepta ±1 paso y rechaza códigos inválidos', () => {
    const now = Date.now();
    expect(verifyTotp(secret, totp(secret, now - 30000), 1, now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 120000), 1, now)).toBe(false);
    expect(verifyTotp(secret, '000000', 1, now)).toBe(totp(secret, now) === '000000');
    expect(verifyTotp(secret, 'abc', 1, now)).toBe(false);
  });
  it('base32 ida y vuelta', () => {
    expect(base32Decode(base32Encode(Buffer.from('hola mundo'))).toString()).toBe('hola mundo');
  });
});

describe('RF-12 Facturación electrónica SRI', () => {
  it('módulo 11 y clave de acceso de 49 dígitos', () => {
    expect(mod11('41261533')).toBe(6);
    const key = accessKey({ date: new Date('2026-10-30T15:00:00Z'), ruc: '1792345678001', ambiente: '1', establecimiento: '001', puntoEmision: '001', secuencial: 123, numericCode: '12345678' });
    expect(key).toHaveLength(49);
    expect(key.startsWith('30102026011792345678001100100100000012312345678')).toBe(true);
    expect(isValidAccessKey(key)).toBe(true);
    expect(isValidAccessKey(key.slice(0, 48) + ((Number(key[48]) + 1) % 10))).toBe(false);
  });
  it('tipos de identificación y formas de pago', () => {
    expect(buyerIdType('CEDULA', '1710034065')).toBe('05');
    expect(buyerIdType('RUC', '1792345678001')).toBe('04');
    expect(buyerIdType('PASAPORTE', 'P123')).toBe('06');
    expect(paymentCode('CASH')).toBe('01');
    expect(paymentCode('CARD')).toBe('19');
  });
  it('XML con IVA 0% y escape de caracteres', () => {
    const xml = buildInvoiceXml({
      accessKey: '1'.repeat(49), ambiente: '1', razonSocial: 'Clínica <A&B>', ruc: '1792345678001', dirMatriz: 'Quito',
      establecimiento: '001', puntoEmision: '001', secuencial: 5, fechaEmision: new Date('2026-10-30T15:00:00Z'), obligadoContabilidad: false,
      buyer: { idType: '05', id: '1710034065', name: 'Pérez Juan' }, items: [{ description: 'Limpieza', quantity: 1, unitPrice: 35, total: 35 }],
      payments: [{ method: 'CASH', amount: 35 }], subtotal: 35, total: 35,
    });
    expect(xml).toContain('<razonSocial>Clínica &lt;A&amp;B&gt;</razonSocial>');
    expect(xml).toContain('<secuencial>000000005</secuencial>');
    expect(xml).toContain('<fechaEmision>30/10/2026</fechaEmision>');
    expect(xml).toContain('<codigoPorcentaje>0</codigoPorcentaje>');
  });
});

describe('RF-04 Periodontograma', () => {
  it('NIC = sondaje + margen gingival', () => {
    expect(calcAttachment([3, 4, 5, 2, 2, 2], [1, 0, -1, 0, 2, 0])).toEqual([4, 4, 4, 2, 4, 2]);
  });
  it('valida 6 puntos, rango y diente', () => {
    expect(validateSite({ toothNumber: 16, probingDepths: [1, 2, 3, 1, 2, 3] })).toBeNull();
    expect(validateSite({ toothNumber: 16, probingDepths: [1, 2] })).toMatch(/6 profundidades/);
    expect(validateSite({ toothNumber: 19, probingDepths: [1, 2, 3, 1, 2, 3] })).toMatch(/no válido/);
    expect(validateSite({ toothNumber: 16, probingDepths: [1, 2, 3, 1, 2, 30] })).toMatch(/rango/);
  });
  it('resumen: % sangrado, sitios ≥4 mm', () => {
    const s = summarize([{ probingDepths: [2, 4, 6, 2, 2, 2], clinicalAttachment: [2, 4, 7, 2, 2, 2], bleeding: [false, true, true, false, false, false], mobility: 1 }]);
    expect(s.bleedingPct).toBe(33);
    expect(s.sitesGte4).toBe(2);
    expect(s.sitesGte6).toBe(1);
    expect(s.stageHint).toBe('Estadio III/IV');
  });
});

describe('RF-07 Presupuestos multinivel', () => {
  it('totales por fase, laboratorio y descuento', () => {
    const t = planTotals(
      [
        { quantity: 1, unitPrice: 220, phase: 1, labCost: 0 },
        { quantity: 2, unitPrice: 100, discount: 20, phase: 2, labCost: 30, approved: true },
      ],
      10,
    );
    expect(t.gross).toBe(420);
    expect(t.subtotal).toBe(400);
    expect(t.total).toBe(390);
    expect(t.labCost).toBe(60);
    expect(t.approvedTotal).toBe(180);
    expect(t.phases).toHaveLength(2);
    expect(t.discountPct).toBeCloseTo(7.14, 1);
  });
  it('descuentos autorizados y transiciones', () => {
    expect(maxDiscountFor('ADMIN')).toBe(100);
    expect(maxDiscountFor('DENTIST')).toBe(10);
    expect(PLAN_TRANSITIONS.COMPLETED).toEqual([]);
  });
});

describe('RF-13 Honorarios', () => {
  const rules = [
    { id: 'g', type: 'PERCENT_GROSS', value: 40 },
    { id: 'd', type: 'PERCENT_GROSS', value: 45, dentistId: 'D1' },
    { id: 'p', type: 'FIXED_AMOUNT', value: 150, procedureId: 'IMP' },
    { id: 'dp', type: 'PERCENT_AFTER_COST', value: 50, procedureId: 'IMP', dentistId: 'D1' },
  ];
  it('prioridad odontólogo+procedimiento > procedimiento > odontólogo > general', () => {
    expect(pickRule(rules, 'D1', 'IMP')!.id).toBe('dp');
    expect(pickRule(rules, 'D2', 'IMP')!.id).toBe('p');
    expect(pickRule(rules, 'D1', 'X')!.id).toBe('d');
    expect(pickRule(rules, 'D2', 'X')!.id).toBe('g');
  });
  it('tres tipos de cálculo', () => {
    expect(commissionFor({ type: 'PERCENT_GROSS', value: 40 }, 100, { lab: 0, materials: 0 }).commission).toBe(40);
    expect(commissionFor({ type: 'PERCENT_AFTER_COST', value: 50 }, 850, { lab: 300, materials: 50 }).commission).toBe(250);
    expect(commissionFor({ type: 'FIXED_AMOUNT', value: 150 }, 850, { lab: 300, materials: 0 }).commission).toBe(150);
  });
});

describe('RF-01 / RF-02 Pacientes', () => {
  it('alertas críticas a partir de la anamnesis', () => {
    const a = computeAlerts({ allergies: ['Penicilina', 'ibuprofeno'], medications: ['Warfarina 5 mg'], systemicDiseases: ['Diabetes tipo 2'], isPregnant: true, pregnancyWeeks: 12 });
    expect(a).toEqual(expect.arrayContaining(['ALERGIA PENICILINA', 'ALERGIA AINES', 'ANTICOAGULADO - riesgo de sangrado', 'DIABÉTICO - control de glucemia', 'EMBARAZO 12 SEMANAS']));
  });
  it('no duplica alertas manuales equivalentes', () => {
    expect(computeAlerts({ allergies: ['Látex'], alerts: ['ALERGIA: LATEX'] })).toHaveLength(1);
  });
  it('cédula ecuatoriana y edad', () => {
    expect(isValidCedula('1710034065')).toBe(true);
    expect(isValidCedula('1710034066')).toBe(false);
    expect(isValidCedula('9910034065')).toBe(false);
    expect(ageFrom('2010-11-01', new Date('2026-10-30'))).toBe(15);
  });
});

describe('RF-10 / RN-03 Agenda', () => {
  it('transiciones de estado', () => {
    expect(TRANSITIONS.SCHEDULED).toContain('CONFIRMED');
    expect(TRANSITIONS.IN_PROGRESS).toContain('COMPLETED');
    expect(TRANSITIONS.SCHEDULED).not.toContain('COMPLETED');
    expect(TRANSITIONS.COMPLETED).toEqual([]);
  });
  it('solapamiento de horarios', () => {
    const d = (h: number) => new Date(Date.UTC(2026, 10, 5, h));
    expect(overlaps(d(9), d(10), d(9), d(10))).toBe(true);
    expect(overlaps(d(9), d(10), d(10), d(11))).toBe(false);
    expect(overlaps(d(9), d(11), d(10), d(12))).toBe(true);
  });
});

describe('RF-11 Notificaciones', () => {
  const now = new Date('2026-11-01T15:00:00Z');
  const at = (h: number) => new Date(now.getTime() + h * 3600000);
  it('recordatorio que corresponde según anticipación', () => {
    expect(reminderDue(at(60), now, new Set())).toBeNull();
    expect(reminderDue(at(40), now, new Set())).toBe('REMINDER_48H');
    expect(reminderDue(at(40), now, new Set(['REMINDER_48H']))).toBeNull();
    expect(reminderDue(at(10), now, new Set(['REMINDER_48H']))).toBe('REMINDER_24H');
    expect(reminderDue(at(-1), now, new Set())).toBeNull();
  });
  it('teléfonos a E.164 y plantillas', () => {
    expect(toE164('0991234567')).toBe('+593991234567');
    expect(toE164('+593991234567')).toBe('+593991234567');
    expect(render('Hola {{nombre}} {{x}}', { nombre: 'Ana' })).toBe('Hola Ana ');
  });
});

describe('RF-02 Recetas vs alergias', () => {
  it('detecta familias de medicamentos', () => {
    expect(allergyConflicts(['Penicilina'], ['Amoxicilina 500 mg'])).toHaveLength(1);
    expect(allergyConflicts(['Aspirina'], ['Ketorolaco 10 mg'])).toHaveLength(1);
    expect(allergyConflicts(['Penicilina'], ['Clindamicina 300 mg'])).toHaveLength(0);
  });
});

describe('RN-01 Inmutabilidad clínica', () => {
  it('los realizados se arrastran a la nueva versión del odontograma', () => {
    const merged = mergeWithDone(
      [{ toothNumber: 16, surface: 'O', condition: 'FILLING', status: 'DONE' }, { toothNumber: 26, condition: 'CARIES', status: 'PENDING' }],
      [{ toothNumber: 36, condition: 'CARIES', status: 'PENDING' }],
    );
    expect(merged.map((m) => m.toothNumber).sort()).toEqual([16, 36]);
  });
  it('firma de nota detecta alteraciones', () => {
    const n = { id: 'n', authorId: 'a', subjective: 's', objective: null, assessment: null, plan: 'p', content: null };
    const at = new Date('2026-10-30T10:00:00Z');
    expect(signatureHashOf(n, at)).toBe(signatureHashOf({ ...n }, at));
    expect(signatureHashOf(n, at)).not.toBe(signatureHashOf({ ...n, plan: 'otro' }, at));
  });
});

describe('RNF-06 Auditoría', () => {
  it('clasifica acciones y entidades', () => {
    expect(describeRequest('PATCH', '/api/consents/cabcdefghijklmnopqrstuvwx/sign')).toEqual({ entity: 'Consent', entityId: 'cabcdefghijklmnopqrstuvwx', action: 'SIGN' });
    expect(describeRequest('GET', '/api/invoices/cabcdefghijklmnopqrstuvwx/sri-xml').action).toBe('EXPORT');
    expect(describeRequest('POST', '/api/patients').action).toBe('CREATE');
  });
  it('no guarda contraseñas ni firmas', () => {
    expect(sanitize({ password: 'x', nested: { signatureData: 'abc', name: 'Ana' } })).toEqual({ password: '[REDACTED]', nested: { signatureData: '[REDACTED]', name: 'Ana' } });
  });
  it('configuración por defecto', () => {
    expect(readSettings(null)).toMatchObject({ noteLockHours: 24, idleTimeoutMin: 15, requireMfa: false });
  });
});

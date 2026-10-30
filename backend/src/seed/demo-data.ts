/**
 * Generador de datos demo para SIGO-Dental.
 *
 * Llena TODAS las áreas del sistema para una clínica (mínimo 20 registros por entidad):
 * personal, sillones, catálogo, pacientes + historia médica + representantes, agenda,
 * odontogramas, periodontogramas, planes de tratamiento, notas SOAP, facturas + pagos,
 * cierres de caja, recetas, consentimientos, inventario + movimientos + recetas de consumo,
 * comisiones, plantillas de mensajes, notificaciones y auditoría.
 *
 * - Los datos son coherentes entre sí (la factura sale de una cita completada, la nota SOAP
 *   corresponde al procedimiento, el inventario se descuenta por cada procedimiento, el cierre
 *   de caja cuadra con los pagos del día, las recetas respetan las alergias del paciente...).
 * - Las fechas se generan en hora de Ecuador (UTC-5) sin importar la zona horaria del servidor.
 * - Es determinista (misma semilla = mismos datos) e idempotente: si la clínica ya fue
 *   sembrada no vuelve a duplicar nada, salvo que se pida `reset`.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import * as C from './catalogs';
import { readSettings } from '../common/clinic-settings';
import { CLINIC_OFFSET_H } from '../common/time';
import { accessKey } from '../invoices/sri';
import { signatureHashOf } from '../clinical-notes/signature';

export const SEED_MARKER = 'SEED_DEMO_V2';
export const DEMO_PASSWORD = 'Demo1234!';

export interface SeedOptions {
  /** Borra los datos operativos de la clínica antes de sembrar (no borra la clínica ni los usuarios). */
  reset?: boolean;
  /** Semilla del generador aleatorio. */
  seed?: number;
  /** Cantidad de pacientes (mínimo 20). */
  patients?: number;
}

// ---------------------------------------------------------------- utilidades

function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)];
  const chance = (p: number) => next() < p;
  const sample = <T>(arr: readonly T[], n: number): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
  };
  const weighted = <T>(items: [T, number][]): T => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r <= 0) return v;
    }
    return items[items.length - 1][0];
  };
  return { next, int, pick, chance, sample, weighted };
}
type Rng = ReturnType<typeof makeRng>;

let idCounter = 0;
/** Id estilo cuid generado en el cliente, para poder usar createMany y enlazar registros. */
function newId() {
  idCounter = (idCounter + 1) % 1679616;
  return 'c' + Date.now().toString(36) + idCounter.toString(36).padStart(4, '0') + randomBytes(6).toString('hex').slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

/** Ecuador continental: UTC-5 fijo (sin horario de verano). */
const EC_OFFSET_H = 5;
function ecClock() {
  const nowEc = new Date(Date.now() - EC_OFFSET_H * 3600_000);
  const y = nowEc.getUTCFullYear();
  const m = nowEc.getUTCMonth();
  const d = nowEc.getUTCDate();
  return {
    /** Fecha (Date real) para el día `offset` relativo a hoy en Ecuador, a la hora local indicada. */
    at: (offset: number, hour = 0, minute = 0) => new Date(Date.UTC(y, m, d + offset, hour + EC_OFFSET_H, minute)),
    weekday: (offset: number) => new Date(Date.UTC(y, m, d + offset)).getUTCDay(),
    dayKey: (date: Date) => new Date(date.getTime() - EC_OFFSET_H * 3600_000).toISOString().slice(0, 10),
    now: new Date(),
  };
}

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Genera una cédula ecuatoriana válida (módulo 10). */
function cedula(rng: Rng) {
  const province = String(rng.int(1, 24)).padStart(2, '0');
  const digits = (province + String(rng.int(0, 5)) + String(rng.int(0, 999999)).padStart(6, '0')).split('').map(Number);
  let sum = 0;
  digits.forEach((dg, i) => {
    let v = dg * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    sum += v;
  });
  return digits.join('') + String((10 - (sum % 10)) % 10);
}

async function chunked<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 500) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

const ADULT_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const CHILD_TEETH = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 85, 84, 83, 82, 81, 71, 72, 73, 74, 75];
const isMolar = (t: number) => [6, 7, 8].includes(t % 10) && t < 50;
const isPosterior = (t: number) => (t < 50 ? t % 10 >= 4 : t % 10 >= 4);

// ---------------------------------------------------------------- reset

export async function resetClinicData(prisma: PrismaClient, clinicId: string) {
  const products = await prisma.product.findMany({ where: { clinicId }, select: { id: true } });
  const productIds = products.map((p) => p.id);
  // Los triggers de inmutabilidad (RN-01 / RNF-06) solo permiten borrar con este indicador, local a la transacción.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL sigo.allow_purge = 'on'`);
      await tx.notificationLog.deleteMany({ where: { clinicId } });
      await tx.messageTemplate.deleteMany({ where: { clinicId } });
      await tx.cashClose.deleteMany({ where: { clinicId } });
      await tx.commissionRule.deleteMany({ where: { clinicId } });
      await tx.prescription.deleteMany({ where: { clinicId } });
      await tx.consent.deleteMany({ where: { clinicId } });
      await tx.consentTemplate.deleteMany({ where: { clinicId } });
      await tx.stockMovement.deleteMany({ where: { clinicId } });
      await tx.procedureConsumption.deleteMany({ where: { productId: { in: productIds } } });
      await tx.product.deleteMany({ where: { clinicId } });
      await tx.periodontogram.deleteMany({ where: { clinicId } });
      await tx.clinicalNote.deleteMany({ where: { clinicId } });
      await tx.invoice.deleteMany({ where: { clinicId } });
      await tx.treatmentPlan.deleteMany({ where: { clinicId } });
      await tx.odontogram.deleteMany({ where: { clinicId } });
      await tx.appointment.deleteMany({ where: { clinicId } });
      await tx.patient.deleteMany({ where: { clinicId } });
      await tx.procedure.deleteMany({ where: { clinicId } });
      await tx.room.deleteMany({ where: { clinicId } });
      await tx.auditLog.deleteMany({ where: { clinicId } });
    },
    { timeout: 120000, maxWait: 20000 },
  );
}

// ---------------------------------------------------------------- seed principal

export async function seedClinicDemoData(
  prisma: PrismaClient,
  clinicId: string,
  adminUserId: string | null,
  opts: SeedOptions = {},
) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) throw new Error(`Clínica ${clinicId} no existe`);

  if (opts.reset) {
    await resetClinicData(prisma, clinicId);
  } else {
    const marker = await prisma.auditLog.findFirst({ where: { clinicId, action: SEED_MARKER } });
    if (marker) {
      return {
        alreadySeeded: true,
        message: 'Esta clínica ya tiene los datos demo. Use reset para regenerarlos.',
        seededAt: marker.createdAt,
      };
    }
  }

  const rng = makeRng(opts.seed ?? 20261030);
  const clock = ecClock();
  const now = clock.now;
  const nPatients = Math.max(20, opts.patients ?? 60);

  // ---------- 1. Sillones / consultorios
  const rooms: Record<string, { id: string; name: string }> = {};
  for (const r of C.ROOMS) {
    let room = await prisma.room.findFirst({ where: { clinicId, name: r.name } });
    if (!room) room = await prisma.room.create({ data: { clinicId, name: r.name, description: r.description } });
    rooms[r.name] = room;
  }
  const chairNames = C.ROOMS.filter((r) => r.name.startsWith('Sillón')).map((r) => r.name);

  // ---------- 2. Personal
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const staff: { id: string; email: string; firstName: string; lastName: string; role: string; specialties: string[] }[] = [];
  const logins: { email: string; role: string }[] = [];
  for (const s of C.STAFF) {
    // El login busca por email en todas las clínicas: si el correo ya existe en otra clínica, se usa uno con sufijo.
    const altEmail = s.email.replace('@', `.${clinicId.slice(-5)}@`);
    let user = await prisma.user.findFirst({ where: { clinicId, email: { in: [s.email, altEmail] } } });
    if (!user) {
      const taken = await prisma.user.findFirst({ where: { email: s.email } });
      const email = taken ? altEmail : s.email;
      user = await prisma.user.create({
        data: {
          clinicId,
          email,
          passwordHash,
          firstName: s.firstName,
          lastName: s.lastName,
          role: s.role as any,
          specialties: [...s.specialties],
          phone: '09' + String(rng.int(80000000, 99999999)),
          lastLoginAt: clock.at(-rng.int(1, 6), rng.int(8, 17), rng.int(0, 59)),
        },
      });
    }
    staff.push(user as any);
    logins.push({ email: user.email, role: user.role });
  }
  const dentists = staff.filter((u) => u.role === 'DENTIST');
  const assistants = staff.filter((u) => u.role === 'ASSISTANT' || u.role === 'RECEPTIONIST');
  const accountants = staff.filter((u) => u.role === 'ACCOUNTANT');
  const actorId = adminUserId ?? staff.find((u) => u.role === 'ADMIN')?.id ?? null;
  const pediatricDentist = dentists.find((d) => d.specialties.includes('Odontopediatría')) ?? dentists[0];

  // ---------- 3. Catálogo de procedimientos
  const procByName: Record<string, any> = {};
  for (const p of C.PROCEDURES) {
    let proc = await prisma.procedure.findFirst({ where: { clinicId, name: p.name } });
    if (!proc) {
      proc = await prisma.procedure.create({
        data: { clinicId, code: p.code, name: p.name, category: p.category, price: p.price, labCost: (p as any).labCost ?? 0, durationMin: p.durationMin, description: `${p.category} · ${p.durationMin} min` },
      });
    }
    procByName[p.name] = proc;
  }
  const procsByCategory: Record<string, any[]> = {};
  for (const p of C.PROCEDURES) (procsByCategory[p.category] ??= []).push(procByName[p.name]);
  const categoryOf = (proc: any) => C.PROCEDURES.find((p) => p.name === proc.name)?.category ?? proc.category ?? 'General';

  // ---------- 4. Inventario (productos + recetas de consumo)
  const productByName: Record<string, any> = {};
  const stock: Record<string, number> = {};
  for (const p of C.PRODUCTS) {
    let prod = await prisma.product.findFirst({ where: { clinicId, name: p.name } });
    if (!prod) {
      prod = await prisma.product.create({ data: { clinicId, sku: p.sku, name: p.name, unit: p.unit, unitCost: p.unitCost, minStock: p.minStock, stock: 0 } });
    }
    productByName[p.name] = prod;
    stock[prod.id] = Number(prod.stock);
  }
  let consumptionsCreated = 0;
  for (const [procName, list] of Object.entries(C.CONSUMPTIONS)) {
    const proc = procByName[procName];
    if (!proc) continue;
    for (const [prodName, qty] of list) {
      const prod = productByName[prodName];
      const exists = await prisma.procedureConsumption.findFirst({ where: { procedureId: proc.id, productId: prod.id } });
      if (!exists) {
        await prisma.procedureConsumption.create({ data: { procedureId: proc.id, productId: prod.id, quantity: qty } });
        consumptionsCreated++;
      }
    }
  }

  // ---------- 5. Plantillas de consentimiento y de mensajes
  const consentTplByCode: Record<string, any> = {};
  const consentTplByName: Record<string, any> = {};
  for (const t of C.CONSENT_TEMPLATES) {
    let tpl = await prisma.consentTemplate.findFirst({ where: { clinicId, name: t.name } });
    if (!tpl) tpl = await prisma.consentTemplate.create({ data: { clinicId, name: t.name, procedureCode: t.code, bodyHtml: t.body } });
    consentTplByName[t.name] = tpl;
    if (t.code) consentTplByCode[t.code] = tpl;
  }
  let messageTemplatesCreated = 0;
  for (const t of C.MESSAGE_TEMPLATES) {
    const exists = await prisma.messageTemplate.findFirst({ where: { clinicId, channel: t.channel, eventType: t.eventType } });
    if (!exists) {
      await prisma.messageTemplate.create({ data: { clinicId, channel: t.channel, eventType: t.eventType, subject: t.subject, body: t.body } });
      messageTemplatesCreated++;
    }
  }

  // ---------- 6. Pacientes
  type P = {
    id: string; firstName: string; lastName: string; age: number; gender: 'MALE' | 'FEMALE'; phone: string; email: string | null;
    allergies: string[]; isActive: boolean; birthDate: Date; createdAt: Date; isChild: boolean;
  };
  const patients: P[] = [];
  const usedDocs = new Set((await prisma.patient.findMany({ where: { clinicId }, select: { documentNumber: true } })).map((p) => p.documentNumber));
  const usedNames = new Set<string>();
  const nChildren = Math.max(4, Math.round(nPatients * 0.2));

  for (let i = 0; i < nPatients; i++) {
    const isChild = i < nChildren;
    const gender = rng.chance(0.55) ? 'FEMALE' : 'MALE';
    let firstName: string, lastName: string;
    do {
      firstName = rng.pick(gender === 'FEMALE' ? C.FEMALE_NAMES : C.MALE_NAMES);
      lastName = `${rng.pick(C.SURNAMES)} ${rng.pick(C.SURNAMES)}`;
    } while (usedNames.has(firstName + lastName));
    usedNames.add(firstName + lastName);

    const age = isChild ? rng.int(4, 15) : rng.weighted<number>([[rng.int(18, 30), 3], [rng.int(31, 50), 4], [rng.int(51, 65), 2], [rng.int(66, 84), 1]]);
    const birthDate = clock.at(-(age * 365 + rng.int(0, 360)), 12);
    const foreign = !isChild && rng.chance(0.05);
    let doc: string;
    do doc = foreign ? `P${rng.int(10000000, 99999999)}` : cedula(rng);
    while (usedDocs.has(doc));
    usedDocs.add(doc);

    const loc = rng.weighted<(typeof C.CITIES)[number]>([[C.CITIES[0], 10], [C.CITIES[1], 2], [C.CITIES[2], 1], [C.CITIES[3], 1], [C.CITIES[4], 2], [C.CITIES[5], 2]]);
    const phone = '09' + String(rng.int(60000000, 99999999));
    const emailUser = stripAccents(`${firstName.split(' ')[0]}.${lastName.split(' ')[0]}`).toLowerCase() + rng.int(1, 99);
    const email = isChild ? null : `${emailUser}@${rng.pick(['gmail.com', 'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'])}`;

    // Historia médica coherente con la edad
    const allergies: string[] = [];
    const alerts = new Set<string>();
    if (rng.chance(0.22)) {
      for (const a of rng.sample(C.ALLERGIES, rng.chance(0.2) ? 2 : 1)) {
        allergies.push(a.allergy);
        alerts.add(a.alert);
      }
    }
    const diseases: string[] = [];
    const medications: string[] = [];
    const diseaseChance = isChild ? 0.05 : age > 55 ? 0.65 : age > 40 ? 0.35 : 0.12;
    if (rng.chance(diseaseChance)) {
      const pool = isChild ? C.DISEASES.filter((d) => d.disease === 'Asma') : C.DISEASES;
      for (const d of rng.sample(pool, age > 60 && rng.chance(0.5) ? 2 : 1)) {
        diseases.push(d.disease);
        medications.push(d.med);
        if (d.alert) alerts.add(d.alert);
      }
    }
    const habits = isChild ? (rng.chance(0.2) ? [rng.pick(['Onicofagia', 'Respirador bucal'])] : []) : rng.sample(C.HABITS, rng.weighted<number>([[0, 5], [1, 4], [2, 1]]));
    const isPregnant = gender === 'FEMALE' && age >= 20 && age <= 40 && rng.chance(0.08);
    const pregnancyWeeks = isPregnant ? rng.int(8, 34) : null;
    if (isPregnant) alerts.add(`EMBARAZO ${pregnancyWeeks} SEMANAS`);

    const isRecent = i >= nPatients - 8;
    const createdAt = isRecent ? clock.at(-rng.int(0, 25), rng.int(8, 17), rng.int(0, 59)) : clock.at(-rng.int(70, 720), rng.int(8, 17), rng.int(0, 59));
    const tags = rng.sample(C.PATIENT_TAGS.filter((t) => t !== 'Nuevo'), rng.weighted<number>([[0, 5], [1, 4], [2, 1]]));
    if (isRecent) tags.push('Nuevo');
    const insured = !isChild && rng.chance(0.35);
    const isActive = !(i % 29 === 7);
    const id = newId();

    const surname1 = lastName.split(' ')[0];
    await prisma.patient.create({
      data: {
        id,
        clinicId,
        documentType: foreign ? 'PASAPORTE' : 'CEDULA',
        documentNumber: doc,
        firstName,
        lastName,
        birthDate,
        gender,
        email,
        phone,
        address: `${rng.pick(loc.streets)} N${rng.int(10, 79)}-${rng.int(10, 299)} y ${rng.pick(loc.streets).replace('Av. ', '')}`,
        city: loc.city,
        occupation: isChild ? 'Estudiante' : rng.pick(C.OCCUPATIONS),
        emergencyContactName: `${rng.pick(rng.chance(0.5) ? C.FEMALE_NAMES : C.MALE_NAMES)} ${surname1}`,
        emergencyContactPhone: '09' + String(rng.int(60000000, 99999999)),
        insuranceName: insured ? rng.pick(C.INSURERS) : null,
        insuranceNumber: insured ? `POL-${rng.int(100000, 999999)}` : null,
        tags,
        isActive,
        notes: rng.chance(0.15) ? rng.pick(['Prefiere citas en la mañana.', 'Ansiedad dental, explicar cada paso.', 'Viene referido por otro paciente.', 'Solicita factura a nombre de su empresa.', 'Prefiere contacto por WhatsApp.']) : null,
        createdAt,
        createdById: actorId,
        medicalHistory: {
          create: {
            allergies,
            medications,
            systemicDiseases: diseases,
            habits,
            surgicalHistory: !isChild && rng.chance(0.25) ? rng.sample(['Apendicectomía', 'Colecistectomía', 'Cesárea', 'Amigdalectomía', 'Cirugía de rodilla', 'Hernioplastia'], rng.int(1, 2)) : [],
            anticoagulated: medications.some((m) => /warfarin/i.test(m)),
            bleedingDisorder: false,
            reviewedAt: createdAt,
            isPregnant,
            pregnancyWeeks,
            bloodType: rng.pick(C.BLOOD_TYPES),
            notes: diseases.length ? 'Paciente en control médico. Interconsulta si cambia la medicación.' : null,
            alerts: [...alerts],
          },
        },
        guardians: isChild
          ? {
              create: [
                {
                  fullName: `${rng.pick(C.FEMALE_NAMES)} ${surname1} ${rng.pick(C.SURNAMES)}`,
                  documentNumber: cedula(rng),
                  relationship: 'Madre',
                  phone,
                  email: `${stripAccents(surname1).toLowerCase()}.familia${rng.int(1, 99)}@gmail.com`,
                },
                ...(rng.chance(0.85)
                  ? [{ fullName: `${rng.pick(C.MALE_NAMES)} ${surname1} ${rng.pick(C.SURNAMES)}`, documentNumber: cedula(rng), relationship: 'Padre', phone: '09' + String(rng.int(60000000, 99999999)), email: null }]
                  : []),
              ],
            }
          : undefined,
      },
    });
    patients.push({ id, firstName, lastName, age, gender, phone, email, allergies, isActive, birthDate, createdAt, isChild });
  }
  const activePatients = patients.filter((p) => p.isActive);
  const adults = activePatients.filter((p) => !p.isChild);
  const children = activePatients.filter((p) => p.isChild);

  // ---------- 7. Agenda (citas sin choques de sillón, odontólogo ni paciente)
  const SPECIALTY_CATEGORIES: Record<string, string[]> = {
    Operatoria: ['Operatoria'], Endodoncia: ['Endodoncia'], Cirugía: ['Cirugía'], 'Cirugía maxilofacial': ['Cirugía'],
    Implantología: ['Implantología'], Ortodoncia: ['Ortodoncia'], Estética: ['Estética'], Periodoncia: ['Periodoncia'],
    Odontopediatría: ['Preventiva', 'Operatoria'], 'Rehabilitación oral': ['Prótesis'], Prótesis: ['Prótesis'],
    'Odontología general': ['General', 'Preventiva', 'Operatoria'],
  };
  const CHILD_PROCS = ['Consulta / Evaluación', 'Limpieza dental (profilaxis)', 'Aplicación de flúor', 'Sellante de fosas y fisuras (por diente)', 'Pulpotomía (diente temporal)', 'Extracción de diente temporal', 'Obturación simple'];
  const TOOTH_CATEGORIES = new Set(['Operatoria', 'Endodoncia', 'Cirugía', 'Implantología', 'Prótesis']);
  const roomFor = (category: string, child: boolean) => {
    if (child) return 'Consultorio D';
    if (category === 'Cirugía' || category === 'Implantología') return rng.pick(['Quirófano 1', 'Quirófano 2']);
    if (category === 'Periodoncia' && rng.chance(0.4)) return 'Quirófano 2';
    if (category === 'Diagnóstico') return 'Sala de Rayos X';
    if (category === 'Ortodoncia') return 'Consultorio C';
    if (category === 'Estética') return 'Sala de Estética';
    if (category === 'General') return rng.pick(['Consultorio A', 'Consultorio B', ...chairNames]);
    return rng.pick(chairNames);
  };

  type Appt = {
    id: string; patient: P; dentistId: string; roomId: string; startAt: Date; endAt: Date; status: string;
    proc: any; category: string; tooth: number | null; dayOffset: number;
  };
  const appts: Appt[] = [];
  const busy: Record<string, [number, number][]> = {};
  const isFree = (key: string, s: number, e: number) => !(busy[key] ?? []).some(([bs, be]) => s < be && e > bs);
  const book = (key: string, s: number, e: number) => (busy[key] ??= []).push([s, e]);
  const nowEcMinutes = (() => {
    const t = new Date(now.getTime() - EC_OFFSET_H * 3600_000);
    return t.getUTCHours() * 60 + t.getUTCMinutes();
  })();

  for (let day = -60; day <= 21; day++) {
    const wd = clock.weekday(day);
    if (wd === 0) continue; // domingo cerrado
    const saturday = wd === 6;
    let count = day < 0 ? rng.int(4, 7) : day === 0 ? 9 : day <= 7 ? rng.int(3, 6) : rng.int(1, 3);
    if (saturday) count = Math.ceil(count / 2);
    const patientsToday = new Set<string>();

    for (let k = 0, tries = 0; k < count && tries < 60; tries++) {
      const child = children.length > 0 && rng.chance(0.15);
      const patient = child ? rng.pick(children) : rng.pick(adults);
      if (patientsToday.has(patient.id)) continue;
      const dentist = child ? (rng.chance(0.85) ? pediatricDentist : rng.pick(dentists)) : rng.pick(dentists);
      let proc: any;
      if (child) proc = procByName[rng.pick(CHILD_PROCS)];
      else if (rng.chance(0.6)) {
        const cats = dentist.specialties.flatMap((s) => SPECIALTY_CATEGORIES[s] ?? ['General']);
        proc = rng.pick(procsByCategory[rng.pick(cats)] ?? procsByCategory['General']);
      } else {
        proc = rng.pick(procsByCategory[rng.weighted<string>([['General', 4], ['Preventiva', 3], ['Operatoria', 3], ['Diagnóstico', 2]])]);
      }
      if (child && proc.name === 'Pulpotomía (diente temporal)' && dentist !== pediatricDentist) continue;
      const category = categoryOf(proc);
      const duration = Math.max(30, Math.ceil((proc.durationMin ?? 30) / 30) * 30);
      const lastHour = saturday ? 13 : 18;
      const startMin = rng.int(8 * 2, lastHour * 2 - duration / 30) * 30; // minutos desde medianoche
      if (startMin < 8 * 60) continue;
      if (!saturday && startMin >= 13 * 60 && startMin < 14 * 60) continue; // almuerzo
      const roomName = roomFor(category, child);
      const room = rooms[roomName];
      const s = day * 1440 + startMin;
      const e = s + duration;
      if (patient.createdAt.getTime() > clock.at(day, 0, startMin).getTime()) continue; // aún no era paciente
      if (!isFree('d' + dentist.id, s, e) || !isFree('r' + room.id, s, e)) continue;
      book('d' + dentist.id, s, e);
      book('r' + room.id, s, e);
      patientsToday.add(patient.id);

      let status: string;
      if (day < 0) status = rng.weighted([['COMPLETED', 78], ['NO_SHOW', 9], ['CANCELLED', 13]]);
      else if (day === 0) {
        if (startMin + duration <= nowEcMinutes) status = rng.chance(0.9) ? 'COMPLETED' : 'NO_SHOW';
        else if (startMin <= nowEcMinutes) status = 'IN_PROGRESS';
        else if (startMin - nowEcMinutes <= 60) status = 'WAITING';
        else status = rng.chance(0.7) ? 'CONFIRMED' : 'SCHEDULED';
      } else if (day <= 2) status = rng.weighted([['CONFIRMED', 60], ['SCHEDULED', 35], ['CANCELLED', 5]]);
      else status = rng.weighted([['SCHEDULED', 85], ['CONFIRMED', 10], ['CANCELLED', 5]]);

      const teeth = child ? CHILD_TEETH : ADULT_TEETH;
      let tooth: number | null = null;
      if (TOOTH_CATEGORIES.has(category) || proc.name.includes('Sellante') || proc.name.includes('Pulpotomía')) {
        tooth = category === 'Endodoncia' && proc.name.includes('multirradicular') ? rng.pick(teeth.filter(isMolar))
          : proc.name.includes('tercer molar') ? rng.pick([18, 28, 38, 48])
          : proc.name.includes('unirradicular') ? rng.pick([13, 12, 11, 21, 22, 23, 33, 32, 31, 41, 42, 43])
          : rng.pick(teeth);
      }
      const startAt = clock.at(day, 0, startMin);
      appts.push({ id: newId(), patient, dentistId: dentist.id, roomId: room.id, startAt, endAt: new Date(startAt.getTime() + duration * MS_MIN), status, proc, category, tooth, dayOffset: day });
      k++;
    }
  }
  appts.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const apptNotes = ['Paciente solicita factura con datos de empresa.', 'Traer radiografías anteriores.', 'Paciente ansioso, dar más tiempo.', 'Confirmado por WhatsApp.', 'Requiere premedicación antibiótica.', 'Viene acompañado de familiar.'];
  await chunked(appts, (chunk) =>
    prisma.appointment.createMany({
      data: chunk.map((a) => ({
        id: a.id,
        clinicId,
        patientId: a.patient.id,
        dentistId: a.dentistId,
        roomId: a.roomId,
        startAt: a.startAt,
        endAt: a.endAt,
        status: a.status as any,
        reason: a.tooth ? `${a.proc.name} - pieza ${a.tooth}` : a.proc.name,
        notes: rng.chance(0.18) ? rng.pick(apptNotes) : a.status === 'CANCELLED' ? rng.pick(['Paciente canceló por viaje.', 'Reagendado por enfermedad.', 'Canceló por trabajo.']) : null,
        isRecurring: a.proc.name === 'Control mensual de ortodoncia',
        procedureId: a.proc.id,
        inventoryDischargedAt: a.status === 'COMPLETED' && C.CONSUMPTIONS[a.proc.name] ? a.endAt : null,
        createdAt: new Date(Math.min(a.startAt.getTime() - rng.int(1, 20) * MS_DAY, now.getTime() - MS_MIN)),
        createdById: rng.pick(assistants)?.id ?? actorId,
      })),
    }),
  );
  const completed = appts.filter((a) => a.status === 'COMPLETED');

  // ---------- 8. Notas clínicas SOAP (firmadas y bloqueadas pasadas 24h — RN de bloqueo)
  const notes: any[] = [];
  const fillTooth = (s: string, t: number | null) => s.replace(/\{d\}/g, String(t ?? rng.pick(ADULT_TEETH)));
  for (const a of completed) {
    if (!rng.chance(0.75)) continue;
    const soap = C.SOAP[a.category] ?? C.SOAP.General;
    const locked = a.endAt.getTime() < now.getTime() - MS_DAY;
    notes.push({
      id: newId(),
      clinicId,
      patientId: a.patient.id,
      appointmentId: a.id,
      authorId: a.dentistId,
      noteType: 'SOAP',
      subjective: fillTooth(rng.pick(soap.s), a.tooth),
      objective: fillTooth(rng.pick(soap.o), a.tooth),
      assessment: fillTooth(rng.pick(soap.a), a.tooth),
      plan: fillTooth(rng.pick(soap.p), a.tooth),
      content: a.patient.allergies.length ? `Se verifica alergia a ${a.patient.allergies.join(', ')} antes del procedimiento.` : null,
      isLocked: locked,
      signedAt: locked ? new Date(a.endAt.getTime() + 20 * MS_MIN) : null,
      createdAt: new Date(a.endAt.getTime() + 5 * MS_MIN),
    });
  }
  // RN-01: algunas adendas firmadas que corrigen notas ya bloqueadas
  for (const original of rng.sample(notes.filter((n) => n.noteType === 'SOAP' && n.isLocked), 6)) {
    const createdAt = new Date(Math.min(original.createdAt.getTime() + rng.int(2, 6) * MS_DAY, now.getTime() - 3600_000));
    notes.push({
      id: newId(), clinicId, patientId: original.patientId, appointmentId: original.appointmentId, authorId: original.authorId,
      noteType: 'ADDENDUM', parentNoteId: original.id,
      content: rng.pick([
        'Adenda: se corrige la pieza tratada; el procedimiento se realizó en la pieza contigua según radiografía.',
        'Adenda: el paciente informó posteriormente alergia leve a látex; se actualiza la historia médica.',
        'Adenda: se omitió registrar la anestesia utilizada (1 carpule de lidocaína 2% con epinefrina).',
        'Adenda: control telefónico a las 48 h, paciente sin dolor ni sangrado.',
      ]),
      isLocked: true, signedAt: new Date(createdAt.getTime() + 2 * MS_MIN), createdAt,
    });
  }
  const signNote = (n: any) => {
    if (n.signedAt) n.signatureHash = signatureHashOf(n, n.signedAt);
  };
  // Notas de evolución sin cita (llamadas, seguimiento)
  for (let i = 0; i < 15; i++) {
    const p = rng.pick(adults);
    const createdAt = clock.at(-rng.int(1, 55), rng.int(9, 17), rng.int(0, 59));
    notes.push({
      id: newId(), clinicId, patientId: p.id, appointmentId: null, authorId: rng.pick(dentists).id, noteType: 'EVOLUTION',
      content: rng.pick([
        'Llamada de seguimiento post-operatorio: paciente sin dolor, sin sangrado.',
        'Paciente llama por sensibilidad leve; se indica pasta desensibilizante.',
        'Se revisa radiografía enviada por el paciente. Sin cambios relevantes.',
        'Paciente informa cambio de medicación por su médico tratante. Se actualiza historia.',
        'Se envía presupuesto por correo. Paciente lo revisará con su seguro.',
      ]),
      isLocked: true, signedAt: new Date(createdAt.getTime() + 10 * MS_MIN), createdAt,
    });
  }
  notes.forEach(signNote);
  await chunked(notes, (chunk) => prisma.clinicalNote.createMany({ data: chunk }));

  // ---------- 9. Odontogramas (incluyen lo realizado en las citas + hallazgos pendientes)
  const doneByPatient: Record<string, { tooth: number; condition: string; procId: string }[]> = {};
  const CONDITION_BY_CATEGORY: Record<string, string> = { Operatoria: 'FILLING', Endodoncia: 'ENDODONTICS', Implantología: 'IMPLANT', Prótesis: 'CROWN' };
  for (const a of completed) {
    if (!a.tooth) continue;
    let condition = CONDITION_BY_CATEGORY[a.category];
    if (a.category === 'Cirugía') condition = 'MISSING';
    if (a.proc.name.includes('Sellante')) condition = 'SEALANT';
    if (a.proc.name.includes('Pulpotomía')) condition = 'ENDODONTICS';
    if (!condition) continue;
    (doneByPatient[a.patient.id] ??= []).push({ tooth: a.tooth, condition, procId: a.proc.id });
  }
  const odontoPatients = [
    ...activePatients.filter((p) => doneByPatient[p.id]),
    ...rng.sample(activePatients.filter((p) => !doneByPatient[p.id]), 40),
  ].slice(0, Math.max(30, Object.keys(doneByPatient).length));
  const PENDING_PROC: Record<string, string> = { CARIES: 'Obturación compuesta (2 superficies)', EXTRACTION_INDICATED: 'Extracción simple', FRACTURE: 'Corona metal-porcelana' };
  const odontograms: any[] = [];
  const toothRecords: any[] = [];
  const pendingFindings: Record<string, { tooth: number; condition: string; surface: string | null }[]> = {};
  for (const p of odontoPatients) {
    const teeth = p.isChild ? CHILD_TEETH : ADULT_TEETH;
    const findings: { tooth: number; surface: string | null; condition: string; status: string; procId?: string; notes?: string }[] = [];
    const usedTeeth = new Set<number>();
    for (const d of doneByPatient[p.id] ?? []) {
      if (usedTeeth.has(d.tooth)) continue;
      usedTeeth.add(d.tooth);
      findings.push({ tooth: d.tooth, surface: d.condition === 'FILLING' || d.condition === 'SEALANT' ? 'O' : null, condition: d.condition, status: 'DONE', procId: d.procId, notes: 'Realizado en clínica' });
    }
    const extra = rng.int(2, p.isChild ? 5 : 8);
    for (let j = 0; j < extra; j++) {
      const tooth = rng.pick(teeth);
      if (usedTeeth.has(tooth)) continue;
      usedTeeth.add(tooth);
      const condition = p.isChild
        ? rng.weighted<string>([['CARIES', 5], ['FILLING', 2], ['SEALANT', 2], ['MISSING', 1]])
        : rng.weighted<string>([['CARIES', 6], ['FILLING', 6], ['CROWN', 2], ['ENDODONTICS', 2], ['MISSING', 2], ['EXTRACTION_INDICATED', 1], ['FRACTURE', 1], ['IMPLANT', 0.5], ['BRIDGE', 0.5], ['SEALANT', 1]]);
      const pending = ['CARIES', 'EXTRACTION_INDICATED', 'FRACTURE'].includes(condition);
      const surfaces = condition === 'CARIES' || condition === 'FILLING' ? rng.sample(isPosterior(tooth) ? ['O', 'M', 'D', 'V', 'L'] : ['M', 'D', 'V', 'L', 'I'], rng.int(1, 2)) : condition === 'SEALANT' ? ['O'] : [null];
      for (const surface of surfaces) {
        findings.push({ tooth, surface, condition, status: pending ? (rng.chance(0.4) ? 'PLANNED' : 'PENDING') : 'DONE', procId: pending ? procByName[PENDING_PROC[condition]]?.id : undefined });
        if (pending) (pendingFindings[p.id] ??= []).push({ tooth, condition, surface });
      }
    }
    const firstDate = new Date(Math.min(Math.max(p.createdAt.getTime(), clock.at(-70).getTime()) + rng.int(0, 5) * MS_DAY, now.getTime() - 3600_000));
    const versions = firstDate.getTime() < now.getTime() - 15 * MS_DAY && rng.chance(0.35) ? 2 : 1;
    for (let v = 1; v <= versions; v++) {
      const oid = newId();
      const createdAt = v === 1 ? firstDate : new Date(Math.min(firstDate.getTime() + rng.int(10, 40) * MS_DAY, now.getTime() - MS_DAY));
      odontograms.push({ id: oid, clinicId, patientId: p.id, version: v, createdAt, createdById: rng.pick(dentists).id, notes: v === 1 ? 'Odontograma inicial' : 'Actualización tras tratamiento' });
      for (const f of findings) {
        // En la versión 1 lo que está "DONE" por la clínica aún no existía como tratado: aparece como caries
        const inV1 = v === 1 && versions === 2 && f.notes === 'Realizado en clínica';
        toothRecords.push({
          id: newId(), odontogramId: oid, toothNumber: f.tooth, surface: f.surface, condition: inV1 ? 'CARIES' : f.condition,
          status: inV1 ? 'PENDING' : f.status, notes: inV1 ? null : f.notes ?? null, procedureId: f.procId ?? null, createdAt,
        });
      }
    }
  }
  await chunked(odontograms, (chunk) => prisma.odontogram.createMany({ data: chunk }));
  await chunked(toothRecords, (chunk) => prisma.toothRecord.createMany({ data: chunk }));

  // ---------- 10. Periodontogramas
  const periodontalPatients = [
    ...new Set([...completed.filter((a) => a.category === 'Periodoncia').map((a) => a.patient), ...rng.sample(adults, 30)]),
  ].slice(0, 24);
  const periodontograms: any[] = [];
  const sites: any[] = [];
  for (const p of periodontalPatients) {
    const severity = p.age > 50 ? rng.int(1, 3) : rng.int(0, 2); // 0 sano, 3 periodontitis avanzada
    const versions = severity >= 2 && rng.chance(0.5) ? 2 : 1;
    const missing = new Set(rng.sample(ADULT_TEETH, severity));
    for (let v = 1; v <= versions; v++) {
      const pid = newId();
      const createdAt = clock.at(-rng.int(v === 1 ? 45 : 2, v === 1 ? 70 : 30), rng.int(9, 17));
      periodontograms.push({
        id: pid, clinicId, patientId: p.id, version: v, createdAt, createdById: rng.pick(dentists).id,
        notes: v === 2 ? 'Reevaluación post raspado y alisado radicular' : ['Periodonto sano', 'Gingivitis', 'Periodontitis estadio II', 'Periodontitis estadio III'][severity],
      });
      for (const tooth of ADULT_TEETH) {
        if (tooth % 10 === 8 || missing.has(tooth)) continue;
        const improve = v === 2 ? 1 : 0;
        const pd = Array.from({ length: 6 }, () => Math.max(1, rng.int(1, 3) + (isMolar(tooth) ? severity : Math.floor(severity / 2)) - improve));
        const gm = Array.from({ length: 6 }, () => (severity >= 2 ? rng.int(0, 2) : rng.int(-1, 0)));
        sites.push({
          id: newId(), periodontogramId: pid, toothNumber: tooth, probingDepths: pd, gingivalMargin: gm,
          clinicalAttachment: pd.map((d, i) => d + gm[i]),
          bleeding: pd.map((d) => d >= 4 ? rng.chance(0.7) : rng.chance(0.1 + severity * 0.05)),
          mobility: severity >= 3 && rng.chance(0.3) ? rng.int(1, 2) : 0,
          furcation: isMolar(tooth) && severity >= 2 ? rng.int(0, 2) : null,
          notes: null,
        });
      }
    }
  }
  await chunked(periodontograms, (chunk) => prisma.periodontogram.createMany({ data: chunk }));
  await chunked(sites, (chunk) => prisma.periodontalSite.createMany({ data: chunk }));

  // ---------- 11. Planes de tratamiento / presupuestos
  const planStatuses = rng.sample(
    [...Array(6).fill('DRAFT'), ...Array(7).fill('PENDING_APPROVAL'), ...Array(7).fill('APPROVED'), ...Array(8).fill('IN_PROGRESS'), ...Array(7).fill('COMPLETED'), ...Array(3).fill('CANCELLED')],
    38,
  );
  const planPatients = [...new Set([...Object.keys(pendingFindings), ...rng.sample(adults, 40).map((p) => p.id)])].slice(0, planStatuses.length);
  const PLAN_TEMPLATES: { title: string; items: string[] }[] = [
    { title: 'Rehabilitación oral', items: ['Endodoncia multirradicular', 'Reconstrucción con poste de fibra', 'Corona de zirconio'] },
    { title: 'Tratamiento de ortodoncia', items: ['Modelos de estudio', 'Radiografía panorámica', 'Instalación de brackets metálicos', 'Control mensual de ortodoncia'] },
    { title: 'Implante unitario', items: ['Tomografía CBCT (zona)', 'Implante dental (fase quirúrgica)', 'Corona sobre implante'] },
    { title: 'Tratamiento periodontal', items: ['Radiografía panorámica', 'Raspado y alisado radicular (por cuadrante)', 'Control post-operatorio'] },
    { title: 'Diseño de sonrisa', items: ['Limpieza dental (profilaxis)', 'Blanqueamiento en consultorio', 'Carilla de porcelana'] },
    { title: 'Cirugía de terceros molares', items: ['Radiografía panorámica', 'Extracción de tercer molar incluido', 'Control post-operatorio'] },
    { title: 'Prótesis removible', items: ['Extracción simple', 'Modelos de estudio', 'Prótesis parcial removible'] },
  ];
  const plans: any[] = [];
  const planItems: any[] = [];
  planPatients.forEach((patientId, idx) => {
    const status = planStatuses[idx];
    const pf = pendingFindings[patientId] ?? [];
    const items: { proc: any; tooth: number | null; surface: string | null; qty: number }[] = [];
    let title: string;
    if (pf.length && rng.chance(0.6)) {
      title = 'Operatoria y saneamiento básico';
      items.push({ proc: procByName['Limpieza dental (profilaxis)'], tooth: null, surface: null, qty: 1 });
      for (const f of pf.slice(0, 5)) items.push({ proc: procByName[PENDING_PROC[f.condition]], tooth: f.tooth, surface: f.condition === 'CARIES' ? f.surface : null, qty: 1 });
    } else {
      const tpl = rng.pick(PLAN_TEMPLATES);
      title = tpl.title;
      const tooth = rng.pick(ADULT_TEETH.filter(isMolar));
      for (const name of tpl.items) {
        const proc = procByName[name];
        const toothSpecific = TOOTH_CATEGORIES.has(categoryOf(proc)) && !name.includes('Prótesis') && !name.includes('Extracción simple');
        const qty = name.includes('Control mensual') ? rng.int(6, 18) : name.includes('por cuadrante') ? rng.int(2, 4) : name.includes('Carilla') ? rng.pick([2, 4, 6]) : name.includes('tercer molar') ? rng.int(1, 4) : 1;
        items.push({ proc, tooth: toothSpecific && qty === 1 ? (name.includes('tercer molar') ? rng.pick([18, 28, 38, 48]) : tooth) : null, surface: null, qty });
      }
    }
    const planId = newId();
    let subtotal = 0;
    items.forEach((it, i) => {
      const unit = Number(it.proc.price);
      const itemDiscount = rng.chance(0.15) ? round2(unit * it.qty * 0.1) : 0;
      subtotal += unit * it.qty - itemDiscount;
      const itemStatus =
        status === 'COMPLETED' ? 'DONE'
        : status === 'IN_PROGRESS' ? (i < Math.ceil(items.length / 2) ? 'DONE' : 'PLANNED')
        : status === 'APPROVED' ? 'PLANNED'
        : 'PENDING';
      const catalogLab = Number((C.PROCEDURES.find((x) => x.name === it.proc.name) as any)?.labCost ?? it.proc.labCost ?? 0);
      planItems.push({
        id: newId(), treatmentPlanId: planId, procedureId: it.proc.id, toothNumber: it.tooth, surface: it.surface, quantity: it.qty, unitPrice: unit,
        labCost: catalogLab, discount: itemDiscount, status: itemStatus, approved: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(status),
        phase: Math.min(i + 1, 3), notes: null,
      });
    });
    const discount = subtotal > 500 && rng.chance(0.5) ? round2(subtotal * 0.05) : 0;
    const createdAt = clock.at(-rng.int(status === 'DRAFT' || status === 'PENDING_APPROVAL' ? 1 : 20, 75), rng.int(9, 17));
    plans.push({
      id: planId, clinicId, patientId, title, status, totalAmount: round2(Math.max(0, subtotal - discount)), discount,
      notes: discount ? 'Descuento 5% por pago de contado.' : status === 'CANCELLED' ? 'Paciente decidió no continuar.' : null,
      approvedAt: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(status) ? new Date(Math.min(createdAt.getTime() + rng.int(1, 7) * MS_DAY, now.getTime() - 3600_000)) : null,
      createdAt, createdById: rng.pick(dentists).id,
    });
  });
  await chunked(plans, (chunk) => prisma.treatmentPlan.createMany({ data: chunk }));
  await chunked(planItems, (chunk) => prisma.treatmentPlanItem.createMany({ data: chunk }));

  // ---------- 12. Facturas + pagos (servicios de salud: IVA 0% en Ecuador)
  const sri = readSettings(clinic.settings).sri;
  const invPrefix = `${sri.establecimiento}-${sri.puntoEmision}-`;
  const lastInv = await prisma.invoice.findFirst({ where: { clinicId, number: { startsWith: invPrefix } }, orderBy: { number: 'desc' }, select: { number: true } });
  let seq = lastInv?.number ? Number(lastInv.number.slice(invPrefix.length)) : 0;
  const invoices: any[] = [];
  const invoiceItems: any[] = [];
  const payments: any[] = [];
  const pickMethod = () => rng.weighted<string>([['CASH', 40], ['CARD', 32], ['TRANSFER', 23], ['INSURANCE', 5]]);
  for (const a of completed) {
    if (!rng.chance(0.88)) continue;
    const id = newId();
    const lines: { description: string; quantity: number; unitPrice: number }[] = [
      { description: a.tooth ? `${a.proc.name} - pieza ${a.tooth}` : a.proc.name, quantity: 1, unitPrice: Number(a.proc.price) },
    ];
    if (['Endodoncia', 'Cirugía', 'Implantología'].includes(a.category) && rng.chance(0.6)) lines.push({ description: 'Radiografía periapical', quantity: rng.int(1, 2), unitPrice: 10 });
    if (a.category === 'General' && rng.chance(0.3)) lines.push({ description: 'Radiografía panorámica', quantity: 1, unitPrice: 25 });
    const total = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const ageDays = (now.getTime() - a.endAt.getTime()) / MS_DAY;
    const status = ageDays > 14
      ? rng.weighted<string>([['PAID', 86], ['PARTIALLY_PAID', 7], ['ISSUED', 3], ['CANCELLED', 4]])
      : rng.weighted<string>([['PAID', 62], ['PARTIALLY_PAID', 18], ['ISSUED', 15], ['DRAFT', 5]]);
    const issuedAt = status === 'DRAFT' ? null : new Date(a.endAt.getTime() + rng.int(2, 15) * MS_MIN);
    let paid = 0;
    if (status === 'PAID') {
      if (total >= 200 && rng.chance(0.5)) {
        const first = round2(total * rng.pick([0.4, 0.5, 0.6]));
        payments.push({ id: newId(), invoiceId: id, amount: first, method: pickMethod(), paidAt: issuedAt, reference: null, notes: 'Abono inicial' });
        const second = new Date(Math.min(issuedAt.getTime() + rng.int(3, 15) * MS_DAY, now.getTime() - MS_DAY));
        payments.push({ id: newId(), invoiceId: id, amount: round2(total - first), method: pickMethod(), paidAt: second.getTime() > issuedAt.getTime() ? second : issuedAt, reference: null, notes: 'Cancelación de saldo' });
      } else {
        payments.push({ id: newId(), invoiceId: id, amount: total, method: pickMethod(), paidAt: issuedAt, reference: null, notes: null });
      }
      paid = total;
    } else if (status === 'PARTIALLY_PAID') {
      paid = round2(total * rng.pick([0.3, 0.5, 0.6]));
      payments.push({ id: newId(), invoiceId: id, amount: paid, method: pickMethod(), paidAt: issuedAt, reference: null, notes: 'Abono' });
    }
    const numbered = status !== 'DRAFT';
    if (numbered) seq++;
    invoices.push({
      id, clinicId, patientId: a.patient.id, number: numbered ? `${invPrefix}${String(seq).padStart(9, '0')}` : null, status,
      sriAccessKey: numbered && clinic.ruc ? accessKey({ date: issuedAt, ruc: clinic.ruc, ambiente: sri.ambiente, establecimiento: sri.establecimiento, puntoEmision: sri.puntoEmision, secuencial: seq, numericCode: String(rng.int(0, 99999999)), offsetH: CLINIC_OFFSET_H }) : null,
      sriStatus: numbered ? (clinic.ruc ? (status === 'CANCELLED' ? 'ANULADA' : 'PENDIENTE_FIRMA') : 'SIN_RUC') : null,
      subtotal: total, tax: 0, total, paidAmount: paid,
      notes: status === 'CANCELLED' ? 'Anulada por error en datos del cliente.' : null,
      issuedAt, createdAt: issuedAt ?? a.endAt,
    });
    lines.forEach((l) => invoiceItems.push({ id: newId(), invoiceId: id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, total: round2(l.quantity * l.unitPrice) }));
  }
  for (const p of payments) {
    if (p.method === 'TRANSFER') p.reference = `TRX-${rng.int(1000000, 9999999)}`;
    if (p.method === 'CARD') p.reference = `VOUCHER ${rng.int(100000, 999999)}`;
    if (p.method === 'INSURANCE') p.reference = `POL-${rng.int(100000, 999999)}`;
  }
  await chunked(invoices, (chunk) => prisma.invoice.createMany({ data: chunk }));
  await chunked(invoiceItems, (chunk) => prisma.invoiceItem.createMany({ data: chunk }));
  await chunked(payments, (chunk) => prisma.payment.createMany({ data: chunk }));

  // ---------- 13. Cierres de caja ciegos (RN-02), cuadrados con los pagos de cada día
  const byDay: Record<string, Record<string, number>> = {};
  for (const p of payments) {
    const key = clock.dayKey(p.paidAt);
    byDay[key] ??= { CASH: 0, CARD: 0, TRANSFER: 0, INSURANCE: 0 };
    byDay[key][p.method] = round2(byDay[key][p.method] + Number(p.amount));
  }
  const cashCloses: any[] = [];
  for (let day = -45; day <= -1; day++) {
    if (clock.weekday(day) === 0) continue;
    const t = byDay[clock.dayKey(clock.at(day, 12))];
    if (!t) continue;
    const diff = rng.weighted<number>([[0, 75], [-rng.int(1, 20) * 0.5, 15], [rng.int(1, 10) * 0.25, 10]]);
    const physicalCash = round2(Math.max(0, t.CASH + diff));
    cashCloses.push({
      id: newId(), clinicId, closeDate: clock.at(day, 19, 0),
      physicalCash, physicalCard: t.CARD, physicalTransfer: round2(t.TRANSFER + t.INSURANCE),
      theoreticalCash: t.CASH, theoreticalCard: t.CARD, theoreticalTransfer: round2(t.TRANSFER + t.INSURANCE),
      differenceCash: round2(physicalCash - t.CASH),
      notes: physicalCash === t.CASH ? 'Cierre cuadrado' : physicalCash > t.CASH ? 'Sobrante de caja' : 'Faltante de caja - revisar vueltos',
      closedById: rng.pick(accountants)?.id ?? actorId,
      createdAt: clock.at(day, 19, rng.int(0, 30)),
    });
  }
  await chunked(cashCloses, (chunk) => prisma.cashClose.createMany({ data: chunk }));

  // ---------- 14. Recetas (respetan alergias del paciente)
  const prescriptions: any[] = [];
  const S = C.PRESCRIPTION_SETS;
  for (const a of completed) {
    const allergicPen = a.patient.allergies.includes('Penicilina');
    const allergicNsaid = a.patient.allergies.some((x) => x === 'Ibuprofeno' || x === 'Aspirina');
    let set: { diagnosis: string; items: any[] } | null = null;
    if (a.patient.isChild && a.proc.name.includes('Pulpotomía')) set = S.child;
    else if (a.patient.isChild) continue;
    else if (a.proc.name.includes('tercer molar') || a.category === 'Implantología' || a.proc.name.includes('quirúrgica')) set = allergicPen ? S.infectionPenicillinAllergy : S.surgery;
    else if (a.category === 'Cirugía') set = allergicNsaid ? S.extractionNsaidAllergy : S.extraction;
    else if (a.category === 'Endodoncia') set = rng.chance(0.5) ? (allergicPen ? S.infectionPenicillinAllergy : S.infection) : allergicNsaid ? null : S.pain;
    else if (a.category === 'Periodoncia') set = S.periodontal;
    else if (a.category === 'Estética' || (a.category === 'Preventiva' && rng.chance(0.15))) set = S.sensitivity;
    if (!set) continue;
    // Sustituciones de seguridad según alergias registradas
    const items = set.items.map((it: any) => {
      if (allergicPen && /Amoxicilina|Penicilina/i.test(it.medication)) return { medication: 'Clindamicina 300 mg', dose: '1 cápsula', frequency: 'cada 8 horas', duration: '7 días', notes: 'Paciente alérgico a penicilina' };
      if (allergicNsaid && /Ibuprofeno|Ketorolaco|Nimesulida|Aspirina|Diclofenaco/i.test(it.medication)) return { medication: 'Paracetamol 1 g', dose: '1 tableta', frequency: 'cada 8 horas', duration: it.duration, notes: 'Paciente alérgico a AINEs' };
      return it;
    });
    set = { diagnosis: set.diagnosis, items };
    const signed = a.endAt.getTime() < now.getTime() - MS_DAY || rng.chance(0.5);
    prescriptions.push({
      id: newId(), clinicId, patientId: a.patient.id, dentistId: a.dentistId, appointmentId: a.id,
      diagnosis: a.tooth ? `${set.diagnosis} - pieza ${a.tooth}` : set.diagnosis,
      indications: 'Dieta blanda. Ante fiebre, sangrado abundante o reacción alérgica acudir inmediatamente.',
      items: set.items, isSigned: signed, signedAt: signed ? new Date(a.endAt.getTime() + 10 * MS_MIN) : null,
      createdAt: new Date(a.endAt.getTime() + 5 * MS_MIN),
    });
  }
  await chunked(prescriptions, (chunk) => prisma.prescription.createMany({ data: chunk }));

  // ---------- 15. Consentimientos
  const consents: any[] = [];
  const sig = () => 'sha256:' + createHash('sha256').update(randomBytes(16)).digest('hex');
  const consentFor = (code: string | undefined, category: string) =>
    (code && consentTplByCode[code]) ||
    { Cirugía: consentTplByCode['CIR-01'], Endodoncia: consentTplByCode['END-01'], Implantología: consentTplByCode['IMP-01'], Periodoncia: consentTplByCode['PER-01'], Ortodoncia: consentTplByCode['ORT-01'], Estética: consentTplByCode['EST-01'], Prótesis: consentTplByCode['PRO-01'] }[category];
  for (const a of appts) {
    if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') continue;
    const tpl = consentFor(C.PROCEDURES.find((p) => p.name === a.proc.name)?.code, a.category);
    if (!tpl) continue;
    const future = a.startAt.getTime() > now.getTime();
    const status = future ? 'PENDING' : rng.chance(0.03) ? 'REVOKED' : 'SIGNED';
    consents.push({
      id: newId(), clinicId, patientId: a.patient.id, templateId: tpl.id, title: tpl.name, contentSnapshot: tpl.bodyHtml,
      status, signedAt: status === 'PENDING' ? null : new Date(a.startAt.getTime() - rng.int(5, 30) * MS_MIN),
      signatureData: status === 'PENDING' ? null : sig(), otpVerified: status !== 'PENDING' && rng.chance(0.7),
      createdAt: new Date(Math.min(a.startAt.getTime() - rng.int(1, 3) * MS_DAY, now.getTime() - MS_MIN)), createdById: rng.pick(assistants)?.id ?? actorId,
    });
  }
  // Consentimiento general + protección de datos a cada paciente (y atención de menores a los niños)
  const generalTpl = consentTplByName['Consentimiento general de atención odontológica'];
  const dataTpl = consentTplByName['Consentimiento de tratamiento de datos personales (LOPDP)'];
  const minorTpl = consentTplByName['Consentimiento para atención de menores de edad'];
  for (const p of patients) {
    for (const tpl of [generalTpl, dataTpl, ...(p.isChild ? [minorTpl] : [])]) {
      const at = new Date(p.createdAt.getTime() + 10 * MS_MIN);
      consents.push({
        id: newId(), clinicId, patientId: p.id, templateId: tpl.id, title: tpl.name, contentSnapshot: tpl.bodyHtml, status: 'SIGNED',
        signedAt: at, signatureData: sig(), otpVerified: true, createdAt: at, createdById: rng.pick(assistants)?.id ?? actorId,
      });
    }
  }
  await chunked(consents, (chunk) => prisma.consent.createMany({ data: chunk }));

  // ---------- 16. Movimientos de inventario (compras, descargos automáticos, ajustes)
  const movements: any[] = [];
  const productList = Object.values(productByName);
  const consumed = new Set(Object.values(C.CONSUMPTIONS).flat().map(([n]) => n));
  const neverRestock = new Set(rng.sample(productList.filter((p) => consumed.has(p.name)), 5).map((p) => p.id)); // quedarán en stock bajo para ver alertas
  const minOf = (p: any) => Number(C.PRODUCTS.find((x) => x.name === p.name)?.minStock ?? p.minStock ?? 1);
  const buy = (p: any, when: Date, reason: string, factor?: number) => {
    const qty = round2(minOf(p) * (factor ?? rng.int(3, 5)));
    stock[p.id] = round2(stock[p.id] + qty);
    movements.push({ id: newId(), clinicId, productId: p.id, type: 'IN', quantity: qty, reason, referenceId: `OC-${rng.int(1000, 9999)}`, createdAt: when, createdById: rng.pick(accountants)?.id ?? actorId });
  };
  for (const p of productList) buy(p, clock.at(-64, 10, rng.int(0, 59)), 'Compra inicial a proveedor', neverRestock.has(p.id) ? 1.5 : undefined);
  for (const a of completed) {
    for (const [prodName, qty] of C.CONSUMPTIONS[a.proc.name] ?? []) {
      const p = productByName[prodName];
      if (stock[p.id] < qty) {
        if (neverRestock.has(p.id)) continue;
        buy(p, new Date(a.startAt.getTime() - 2 * 3600_000), 'Reposición de stock');
      }
      stock[p.id] = round2(stock[p.id] - qty);
      movements.push({ id: newId(), clinicId, productId: p.id, type: 'OUT', quantity: qty, reason: `Descargo automático: ${a.proc.name}`, referenceId: a.id, createdAt: a.endAt, createdById: a.dentistId });
    }
  }
  // Consumo general (guantes, mascarillas, baberos) semanal + reposición quincenal
  for (let day = -60; day <= -1; day += 7) {
    for (const name of ['Guantes de nitrilo (caja x100)', 'Guantes de látex (caja x100)', 'Mascarillas quirúrgicas (caja)', 'Baberos desechables (paquete x125)', 'Eyectores de saliva (bolsa x100)', 'Algodón rollo (paquete)']) {
      const p = productByName[name];
      const qty = rng.int(1, 3);
      if (stock[p.id] < qty + minOf(p) && !neverRestock.has(p.id)) buy(p, clock.at(day, 9), 'Reposición quincenal');
      if (stock[p.id] < qty) continue;
      stock[p.id] = round2(stock[p.id] - qty);
      movements.push({ id: newId(), clinicId, productId: p.id, type: 'OUT', quantity: qty, reason: 'Consumo semanal de bioseguridad', referenceId: null, createdAt: clock.at(day, 18), createdById: rng.pick(assistants)?.id ?? actorId });
    }
  }
  // Merma en productos sin reposición para que aparezcan en alertas de stock bajo
  for (const p of productList.filter((x) => neverRestock.has(x.id))) {
    const target = round2(minOf(p) * 0.5);
    if (stock[p.id] > target) {
      const qty = round2(stock[p.id] - target);
      stock[p.id] = target;
      movements.push({ id: newId(), clinicId, productId: p.id, type: 'OUT', quantity: qty, reason: 'Merma / material vencido', referenceId: null, createdAt: clock.at(-1, 18, 45), createdById: rng.pick(assistants)?.id ?? actorId });
    }
  }
  // Ajustes por conteo físico (ADJUST fija el stock al valor contado). Se recalcula todo en orden cronológico.
  for (const p of rng.sample(productList.filter((x) => !neverRestock.has(x.id)), 6)) {
    movements.push({ id: newId(), clinicId, productId: p.id, type: 'ADJUST', quantity: 0, _delta: rng.pick([-1, 1, 2]), reason: 'Ajuste por inventario físico mensual', referenceId: null, createdAt: clock.at(-rng.int(8, 20), 18, 30), createdById: rng.pick(accountants)?.id ?? actorId });
  }
  movements.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
  for (const p of productList) stock[p.id] = Number(p.stock);
  for (const m of movements) {
    if (m.type === 'IN') stock[m.productId] = round2(stock[m.productId] + m.quantity);
    else if (m.type === 'OUT') stock[m.productId] = round2(stock[m.productId] - m.quantity);
    else {
      const counted = round2(stock[m.productId] + (stock[m.productId] >= minOf(productList.find((p) => p.id === m.productId)) + 2 ? m._delta : Math.abs(m._delta)));
      m.quantity = counted;
      stock[m.productId] = counted;
    }
    delete m._delta;
  }
  await chunked(movements, (chunk) => prisma.stockMovement.createMany({ data: chunk }));
  for (const p of productList) {
    await prisma.product.update({ where: { id: p.id }, data: { stock: Math.max(0, stock[p.id]) } });
  }

  // ---------- 17. Reglas de comisión / honorarios
  const rules: any[] = [
    { name: 'Comisión general de la clínica', type: 'PERCENT_GROSS', value: 40, procedureId: null, dentistId: null },
    ...dentists.map((d) => ({ name: `Honorarios Dr(a). ${d.firstName} ${d.lastName}`, type: 'PERCENT_GROSS', value: d.specialties.includes('Odontología general') ? 35 : rng.pick([38, 40, 42, 45]), procedureId: null, dentistId: d.id })),
    { name: 'Implante: monto fijo por pieza', type: 'FIXED_AMOUNT', value: 150, procedureId: procByName['Implante dental (fase quirúrgica)'].id, dentistId: null },
    { name: 'Corona sobre implante: monto fijo', type: 'FIXED_AMOUNT', value: 100, procedureId: procByName['Corona sobre implante'].id, dentistId: null },
    { name: 'Brackets: % después de costo de material', type: 'PERCENT_AFTER_COST', value: 50, procedureId: procByName['Instalación de brackets metálicos'].id, dentistId: null },
    { name: 'Corona de zirconio: % después de laboratorio', type: 'PERCENT_AFTER_COST', value: 40, procedureId: procByName['Corona de zirconio'].id, dentistId: null },
    { name: 'Corona metal-porcelana: % después de laboratorio', type: 'PERCENT_AFTER_COST', value: 40, procedureId: procByName['Corona metal-porcelana'].id, dentistId: null },
    { name: 'Endodoncia multirradicular', type: 'PERCENT_GROSS', value: 45, procedureId: procByName['Endodoncia multirradicular'].id, dentistId: null },
    { name: 'Tercer molar incluido', type: 'PERCENT_GROSS', value: 45, procedureId: procByName['Extracción de tercer molar incluido'].id, dentistId: null },
    { name: 'Blanqueamiento en consultorio', type: 'PERCENT_GROSS', value: 30, procedureId: procByName['Blanqueamiento en consultorio'].id, dentistId: null },
    { name: 'Profilaxis (higienista)', type: 'FIXED_AMOUNT', value: 8, procedureId: procByName['Limpieza dental (profilaxis)'].id, dentistId: null },
  ];
  await prisma.commissionRule.createMany({ data: rules.map((r) => ({ id: newId(), clinicId, isActive: true, ...r })) });

  // ---------- 18. Notificaciones (recordatorios, post-operatorios, cumpleaños, cobranza)
  const logs: any[] = [];
  const fmt = (d: Date) => {
    const t = new Date(d.getTime() - EC_OFFSET_H * 3600_000);
    return { date: `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${t.getUTCFullYear()}`, time: `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}` };
  };
  for (const a of appts) {
    if (a.dayOffset < -30 || a.dayOffset > 3) continue;
    const sendAt = new Date(a.startAt.getTime() - MS_DAY);
    const due = sendAt.getTime() <= now.getTime();
    const { date, time } = fmt(a.startAt);
    const body = `Hola ${a.patient.firstName}, le recordamos su cita en ${clinic.name} el ${date} a las ${time}. Responda SÍ para confirmar.`;
    const failed = due && rng.chance(0.05);
    logs.push({ id: newId(), clinicId, patientId: a.patient.id, appointmentId: a.id, eventType: 'REMINDER_24H', channel: 'WHATSAPP', toAddress: a.patient.phone, body, status: due ? (failed ? 'FAILED' : 'SENT') : 'PENDING', error: failed ? 'Número no registrado en WhatsApp' : null, sentAt: due && !failed ? sendAt : null, createdAt: due ? sendAt : new Date(now.getTime() - rng.int(1, 600) * MS_MIN) });
    if (a.patient.email && rng.chance(0.6)) {
      logs.push({ id: newId(), clinicId, patientId: a.patient.id, appointmentId: a.id, eventType: 'REMINDER_24H', channel: 'EMAIL', toAddress: a.patient.email, body, status: due ? 'SENT' : 'PENDING', error: null, sentAt: due ? sendAt : null, createdAt: due ? sendAt : new Date(now.getTime() - rng.int(1, 600) * MS_MIN) });
    }
    if (a.status === 'COMPLETED' && ['Cirugía', 'Implantología', 'Endodoncia'].includes(a.category)) {
      const at = new Date(a.endAt.getTime() + 20 * 3600_000);
      if (at.getTime() <= now.getTime()) logs.push({ id: newId(), clinicId, patientId: a.patient.id, appointmentId: a.id, eventType: 'POST_OP', channel: 'WHATSAPP', toAddress: a.patient.phone, body: `Hola ${a.patient.firstName}, ¿cómo se siente después de su procedimiento? Ante cualquier molestia escríbanos.`, status: 'SENT', error: null, sentAt: at, createdAt: at });
    }
    if (a.status === 'NO_SHOW') {
      const at = new Date(a.endAt.getTime() + 2 * 3600_000);
      if (at.getTime() <= now.getTime()) logs.push({ id: newId(), clinicId, patientId: a.patient.id, appointmentId: a.id, eventType: 'NO_SHOW_FOLLOWUP', channel: 'SMS', toAddress: a.patient.phone, body: `${clinic.name}: no asistio a su cita. Llame para reagendar.`, status: 'SENT', error: null, sentAt: at, createdAt: at });
    }
  }
  for (const p of rng.sample(activePatients, 12)) {
    const at = clock.at(-rng.int(1, 30), 8, 0);
    logs.push({ id: newId(), clinicId, patientId: p.id, eventType: 'BIRTHDAY', channel: 'WHATSAPP', toAddress: p.phone, body: `¡Feliz cumpleaños ${p.firstName}! 🎉 Todo el equipo de ${clinic.name} le desea un gran día.`, status: 'SENT', error: null, sentAt: at, createdAt: at });
  }
  for (const inv of invoices.filter((i) => i.status === 'PARTIALLY_PAID' || i.status === 'ISSUED')) {
    const p = patients.find((x) => x.id === inv.patientId);
    const at = new Date(Math.min(inv.issuedAt.getTime() + 5 * MS_DAY, now.getTime() - 3600_000));
    logs.push({ id: newId(), clinicId, patientId: p.id, eventType: 'PAYMENT_REMINDER', channel: 'WHATSAPP', toAddress: p.phone, body: `Hola ${p.firstName}, tiene un saldo pendiente de $${round2(inv.total - inv.paidAmount).toFixed(2)} en la factura ${inv.number}.`, status: 'SENT', error: null, sentAt: at, createdAt: at });
  }
  await chunked(logs, (chunk) => prisma.notificationLog.createMany({ data: chunk }));

  // ---------- 19. Auditoría
  const audit: any[] = [];
  for (let day = -30; day <= 0; day++) {
    if (clock.weekday(day) === 0) continue;
    for (const u of rng.sample(staff, rng.int(5, 10))) {
      if (clock.at(day, 7, 59).getTime() > now.getTime()) continue;
      audit.push({ id: newId(), clinicId, userId: u.id, action: 'LOGIN', entity: 'User', entityId: u.id, ipAddress: `192.168.1.${rng.int(10, 250)}`, userAgent: rng.pick(['Chrome 130 / Windows 11', 'Safari / macOS', 'Chrome / Android']), createdAt: clock.at(day, 7, rng.int(45, 59) + 0) });
    }
  }
  for (const inv of invoices.filter((i) => i.issuedAt)) audit.push({ id: newId(), clinicId, userId: rng.pick(accountants)?.id ?? actorId, action: 'CREATE', entity: 'Invoice', entityId: inv.id, newData: { number: inv.number, total: inv.total }, createdAt: inv.issuedAt });
  for (const n of notes.filter((x) => x.signedAt)) audit.push({ id: newId(), clinicId, userId: n.authorId, action: 'SIGN', entity: 'ClinicalNote', entityId: n.id, createdAt: n.signedAt });
  for (const c of cashCloses) audit.push({ id: newId(), clinicId, userId: c.closedById, action: 'CASH_CLOSE', entity: 'CashClose', entityId: c.id, newData: { differenceCash: c.differenceCash }, createdAt: c.createdAt });
  for (const p of patients) audit.push({ id: newId(), clinicId, userId: rng.pick(assistants)?.id ?? actorId, action: 'CREATE', entity: 'Patient', entityId: p.id, createdAt: p.createdAt });
  audit.push({ id: newId(), clinicId, userId: actorId, action: SEED_MARKER, entity: 'Clinic', entityId: clinicId, newData: { patients: patients.length, appointments: appts.length }, createdAt: now });
  await chunked(audit, (chunk) => prisma.auditLog.createMany({ data: chunk }));

  const summary = {
    usuarios: staff.length,
    sillones: Object.keys(rooms).length,
    procedimientos: Object.keys(procByName).length,
    pacientes: patients.length,
    citas: appts.length,
    notasClinicas: notes.length,
    odontogramas: odontograms.length,
    registrosDientes: toothRecords.length,
    periodontogramas: periodontograms.length,
    sitiosPeriodontales: sites.length,
    planesTratamiento: plans.length,
    itemsPlan: planItems.length,
    facturas: invoices.length,
    pagos: payments.length,
    cierresCaja: cashCloses.length,
    recetas: prescriptions.length,
    plantillasConsentimiento: Object.keys(consentTplByName).length,
    consentimientos: consents.length,
    productos: productList.length,
    movimientosInventario: movements.length,
    recetasConsumoNuevas: consumptionsCreated,
    reglasComision: rules.length,
    plantillasMensajes: messageTemplatesCreated,
    notificaciones: logs.length,
    auditoria: audit.length,
  };
  return {
    message: 'Datos demo cargados correctamente',
    summary,
    password: DEMO_PASSWORD,
    logins,
  };
}

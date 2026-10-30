/**
 * RF-02: genera las alertas críticas visibles en la cabecera del expediente
 * a partir de la anamnesis. Las alertas manuales se conservan.
 */
export interface MedicalInput {
  allergies?: string[];
  systemicDiseases?: string[];
  medications?: string[];
  anticoagulated?: boolean;
  bleedingDisorder?: boolean;
  isPregnant?: boolean;
  pregnancyWeeks?: number | null;
  alerts?: string[];
}

const DISEASE_RULES: [RegExp, string][] = [
  [/hipertens/i, 'HIPERTENSO - medir presión antes de anestesia'],
  [/diabet/i, 'DIABÉTICO - control de glucemia'],
  [/asma/i, 'ASMÁTICO - tener inhalador a mano'],
  [/cardi|infarto|marcapaso|valvul|arritmia|fibrilaci/i, 'CARDIOPATÍA - evaluar profilaxis y vasoconstrictor'],
  [/epilep|convuls/i, 'EPILEPSIA - riesgo de convulsión'],
  [/vih|hepatitis/i, 'ENFERMEDAD INFECTOCONTAGIOSA - bioseguridad reforzada'],
  [/renal/i, 'INSUFICIENCIA RENAL - ajustar dosis'],
];
const MED_RULES: [RegExp, string][] = [
  [/warfarin|acenocumarol|rivaroxab|apixab|dabigatr|clopidogrel|heparin/i, 'ANTICOAGULADO - riesgo de sangrado'],
  [/alendron|zoledr|bifosfon|risedron|ibandron/i, 'BIFOSFONATOS - riesgo de osteonecrosis'],
];

export function computeAlerts(m: MedicalInput): string[] {
  const out = new Set<string>();
  for (const a of m.allergies ?? []) {
    const t = a.trim();
    if (!t) continue;
    if (/ibuprofen|aspirin|aine|diclofen|ketorol|naproxen/i.test(t)) out.add('ALERGIA AINES');
    out.add(`ALERGIA ${t.toUpperCase()}`);
  }
  for (const d of m.systemicDiseases ?? []) for (const [re, alert] of DISEASE_RULES) if (re.test(d)) out.add(alert);
  for (const med of m.medications ?? []) for (const [re, alert] of MED_RULES) if (re.test(med)) out.add(alert);
  if (m.anticoagulated) out.add('ANTICOAGULADO - riesgo de sangrado');
  if (m.bleedingDisorder) out.add('COAGULOPATÍA - riesgo de sangrado');
  if (m.isPregnant) out.add(m.pregnancyWeeks ? `EMBARAZO ${m.pregnancyWeeks} SEMANAS` : 'EMBARAZO');
  // Conservar alertas manuales que no sean automáticas
  for (const a of m.alerts ?? []) if (a?.trim()) out.add(a.trim());
  return dedupeAlerts([...out]);
}

/** Evita duplicados como "ALERGIA PENICILINA" y "ALERGIA: PENICILINA". */
function dedupeAlerts(list: string[]) {
  const seen = new Set<string>();
  return list.filter((a) => {
    const k = a.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function ageFrom(birthDate?: Date | string | null, now = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/** Valida cédula ecuatoriana (módulo 10). */
export function isValidCedula(c: string) {
  if (!/^\d{10}$/.test(c)) return false;
  const prov = Number(c.slice(0, 2));
  if (prov < 1 || (prov > 24 && prov !== 30)) return false;
  if (Number(c[2]) > 5) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === Number(c[9]);
}

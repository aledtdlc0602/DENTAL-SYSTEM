'use client';

/** RF-02: campos de anamnesis reutilizables (alta de paciente y edición del expediente). */
export type MedicalForm = {
  allergies: string;
  medications: string;
  systemicDiseases: string;
  surgicalHistory: string;
  habits: string;
  anticoagulated: boolean;
  bleedingDisorder: boolean;
  isPregnant: boolean;
  pregnancyWeeks: string;
  bloodType: string;
  notes: string;
};

export const emptyMedical: MedicalForm = {
  allergies: '', medications: '', systemicDiseases: '', surgicalHistory: '', habits: '',
  anticoagulated: false, bleedingDisorder: false, isPregnant: false, pregnancyWeeks: '', bloodType: '', notes: '',
};

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function medicalFromHistory(h: any): MedicalForm {
  if (!h) return { ...emptyMedical };
  return {
    allergies: (h.allergies || []).join(', '),
    medications: (h.medications || []).join(', '),
    systemicDiseases: (h.systemicDiseases || []).join(', '),
    surgicalHistory: (h.surgicalHistory || []).join(', '),
    habits: (h.habits || []).join(', '),
    anticoagulated: !!h.anticoagulated,
    bleedingDisorder: !!h.bleedingDisorder,
    isPregnant: !!h.isPregnant,
    pregnancyWeeks: h.pregnancyWeeks ? String(h.pregnancyWeeks) : '',
    bloodType: h.bloodType || '',
    notes: h.notes || '',
  };
}

export function medicalPayload(m: MedicalForm) {
  return {
    allergies: list(m.allergies),
    medications: list(m.medications),
    systemicDiseases: list(m.systemicDiseases),
    surgicalHistory: list(m.surgicalHistory),
    habits: list(m.habits),
    anticoagulated: m.anticoagulated,
    bleedingDisorder: m.bleedingDisorder,
    isPregnant: m.isPregnant,
    pregnancyWeeks: m.isPregnant && m.pregnancyWeeks ? Number(m.pregnancyWeeks) : undefined,
    bloodType: m.bloodType || undefined,
  };
}

export default function MedicalHistoryFields({ value, onChange, showPregnancy = true }: { value: MedicalForm; onChange: (m: MedicalForm) => void; showPregnancy?: boolean }) {
  const set = (k: keyof MedicalForm, v: any) => onChange({ ...value, [k]: v });
  const field = (k: keyof MedicalForm, label: string, placeholder: string) => (
    <div>
      <label className="label">{label}</label>
      <input value={value[k] as string} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('allergies', 'Alergias a fármacos / materiales', 'Penicilina, látex… (separar con coma)')}
        {field('medications', 'Medicación actual', 'Losartán 50 mg, Warfarina…')}
        {field('systemicDiseases', 'Enfermedades sistémicas', 'Hipertensión, diabetes…')}
        {field('surgicalHistory', 'Antecedentes quirúrgicos', 'Apendicectomía…')}
        {field('habits', 'Hábitos', 'Fumador, bruxismo…')}
        <div>
          <label className="label">Tipo de sangre</label>
          <select value={value.bloodType} onChange={(e) => set('bloodType', e.target.value)}>
            <option value="">—</option>
            {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="w-4 h-4" checked={value.anticoagulated} onChange={(e) => set('anticoagulated', e.target.checked)} /> Anticoagulado
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="w-4 h-4" checked={value.bleedingDisorder} onChange={(e) => set('bleedingDisorder', e.target.checked)} /> Coagulopatía
        </label>
        {showPregnancy && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="w-4 h-4" checked={value.isPregnant} onChange={(e) => set('isPregnant', e.target.checked)} /> Embarazo
          </label>
        )}
        {showPregnancy && value.isPregnant && (
          <label className="inline-flex items-center gap-2">
            Semanas <input type="number" min={1} max={42} className="!w-20" value={value.pregnancyWeeks} onChange={(e) => set('pregnancyWeeks', e.target.value)} />
          </label>
        )}
      </div>
      <p className="text-xs text-slate-400">Las alertas críticas (alergias, anticoagulación, embarazo, cardiopatías…) se generan automáticamente y se muestran en la cabecera del expediente.</p>
    </div>
  );
}

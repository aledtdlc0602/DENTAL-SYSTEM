'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Odontogram from '@/components/Odontogram';
import Periodontogram from '@/components/Periodontogram';
import SignaturePad from '@/components/SignaturePad';
import MedicalHistoryFields, { medicalFromHistory, medicalPayload, MedicalForm } from '@/components/MedicalHistoryFields';
import Icon from '@/components/Icons';
import { AlertBadges, Badge, Empty, ErrorBox, Modal, Notice, Spinner, Tabs } from '@/components/ui';
import { api, getUser, hasRole } from '@/lib/api';
import { APPT_STATUS, INVOICE_STATUS, PLAN_STATUS, drName, fmtDate, fmtDateTime, fullName, money, plural } from '@/lib/format';
import { escapeHtml, openPrint, sanitizeHtml } from '@/lib/print';

const GENDER: Record<string, string> = { FEMALE: 'Femenino', MALE: 'Masculino', OTHER: 'Otro' };

type Tab = 'summary' | 'odontogram' | 'perio' | 'notes' | 'plans' | 'consents' | 'rx' | 'billing';

export default function PatientDetailPage() {
  const { id } = useParams() as { id: string };
  const [tab, setTab] = useState<Tab>('summary');
  const [patient, setPatient] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setPatient(await api(`/patients/${id}`));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <AppShell><Spinner label="Cargando expediente…" /></AppShell>;
  if (!patient)
    return (
      <AppShell>
        <ErrorBox error={error || 'Paciente no encontrado'} />
        <Link href="/patients" className="text-brand-700 text-sm">← Pacientes</Link>
      </AppShell>
    );

  const clinical = hasRole('DENTIST', 'ASSISTANT');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Resumen y anamnesis' },
    ...(clinical
      ? ([
          { id: 'odontogram', label: 'Odontograma' },
          { id: 'perio', label: 'Periodontograma' },
          { id: 'notes', label: 'Evolución SOEP' },
        ] as { id: Tab; label: string }[])
      : []),
    { id: 'plans', label: 'Presupuestos' },
    { id: 'consents', label: 'Consentimientos' },
    ...(clinical ? ([{ id: 'rx', label: 'Recetas' }] as { id: Tab; label: string }[]) : []),
    { id: 'billing', label: 'Citas y pagos' },
  ];

  return (
    <AppShell roles={['DENTIST', 'ASSISTANT', 'RECEPTIONIST']}>
      {/* Cabecera del expediente: identificación y alertas médicas de alta visibilidad */}
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[15px] font-semibold text-brand-800">
              {`${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate">{fullName(patient)}</h1>
              <dl className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
                {[
                  [patient.documentType === 'CEDULA' ? 'Cédula' : patient.documentType, patient.documentNumber],
                  ['Edad', patient.age !== null ? `${patient.age} años` : null],
                  ['Celular', patient.phone],
                  ['Seguro', patient.insuranceName],
                  ['Sangre', patient.medicalHistory?.bloodType],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k as string} className="flex gap-1.5">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="font-medium tabular-nums text-ink">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
          {patient.pendingBalance > 0 && (
            <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 lg:text-right">
              <div className="text-[12.5px] font-medium text-amber-800">Saldo pendiente</div>
              <div className="text-[18px] font-semibold tabular-nums text-amber-900">{money(patient.pendingBalance)}</div>
            </div>
          )}
        </div>
        {patient.medicalHistory?.alerts?.length ? (
          <div className="flex flex-col gap-2 border-t border-red-200 bg-red-50 px-5 py-3 sm:flex-row sm:items-center">
            <span className="shrink-0 text-[12.5px] font-semibold text-red-800">Alertas médicas</span>
            <AlertBadges alerts={patient.medicalHistory.alerts} />
          </div>
        ) : (
          <div className="border-t border-line bg-[#f8fafb] px-5 py-2.5 text-[12.5px] text-ink-muted">Sin alertas médicas registradas.</div>
        )}
      </section>

      <div className="mt-6">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === 'summary' && <SummaryTab patient={patient} reload={load} />}
        {tab === 'odontogram' && <Odontogram patientId={id} readOnly={!hasRole('DENTIST')} />}
        {tab === 'perio' && <Periodontogram patientId={id} readOnly={!hasRole('DENTIST')} />}
        {tab === 'notes' && <NotesTab patientId={id} appointments={patient.appointments || []} />}
        {tab === 'plans' && <PlansTab patientId={id} />}
        {tab === 'consents' && <ConsentsTab patient={patient} />}
        {tab === 'rx' && <RxTab patient={patient} />}
        {tab === 'billing' && <BillingTab patient={patient} />}
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ Resumen */
function SummaryTab({ patient, reload }: { patient: any; reload: () => void }) {
  const [editMed, setEditMed] = useState(false);
  const [med, setMed] = useState<MedicalForm>(medicalFromHistory(patient.medicalHistory));
  const [manualAlerts, setManualAlerts] = useState('');
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState<any>({});
  const [guardian, setGuardian] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const canEdit = hasRole('DENTIST', 'ASSISTANT', 'RECEPTIONIST');

  useEffect(() => {
    if (hasRole('DENTIST', 'ASSISTANT')) api(`/patients/${patient.id}/timeline`).then(setTimeline).catch(() => setTimeline([]));
  }, [patient.id]);

  async function saveMedical(e: React.FormEvent) {
    e.preventDefault();
    try {
      const alerts = manualAlerts.split(',').map((a) => a.trim()).filter(Boolean);
      await api(`/patients/${patient.id}/medical-history`, { method: 'PUT', body: JSON.stringify({ ...medicalPayload(med), ...(alerts.length ? { alerts } : {}) }) });
      setEditMed(false);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = Object.fromEntries(Object.entries(info).filter(([, v]) => v !== ''));
      await api(`/patients/${patient.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setEditInfo(false);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function addGuardian(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/patients/${patient.id}/guardians`, { method: 'POST', body: JSON.stringify(Object.fromEntries(Object.entries(guardian).filter(([, v]) => v !== ''))) });
      setGuardian(null);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const h = patient.medicalHistory || {};
  const row = (label: string, value: any) => (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
  const editable = ['firstName', 'lastName', 'phone', 'email', 'address', 'city', 'occupation', 'emergencyContactName', 'emergencyContactPhone', 'insuranceName', 'insuranceNumber', 'notes'];
  const labels: Record<string, string> = { firstName: 'Nombres', lastName: 'Apellidos', phone: 'Celular', email: 'Email', address: 'Dirección', city: 'Ciudad', occupation: 'Ocupación', emergencyContactName: 'Contacto emergencia', emergencyContactPhone: 'Teléfono emergencia', insuranceName: 'Seguro', insuranceNumber: 'Póliza', notes: 'Observaciones' };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ErrorBox error={error} onClose={() => setError('')} />
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Datos del paciente</h3>
          {canEdit && <button className="btn-secondary !py-1 text-xs" onClick={() => { setInfo(Object.fromEntries(editable.map((k) => [k, patient[k] ?? '']))); setEditInfo(true); }}><Icon name="edit" size={14} /> Editar</button>}
        </div>
        {row('Nacimiento', fmtDate(patient.birthDate))}
        {row('Sexo', GENDER[patient.gender] || '—')}
        {row('Email', patient.email)}
        {row('Dirección', [patient.address, patient.city].filter(Boolean).join(', '))}
        {row('Ocupación', patient.occupation)}
        {row('Emergencia', [patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(' · '))}
        {row('Seguro', [patient.insuranceName, patient.insuranceNumber].filter(Boolean).join(' · '))}
        {row('Etiquetas', patient.tags?.join(', '))}
        {row('Observaciones', patient.notes)}

        <div className="mt-5 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Representantes legales</h4>
          {canEdit && <button className="text-xs font-semibold text-brand-700" onClick={() => setGuardian({ fullName: '', relationship: 'Madre', documentNumber: '', phone: '', email: '' })}>+ Agregar</button>}
        </div>
        {patient.guardians?.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {patient.guardians.map((g: any) => (
              <li key={g.id}>{g.fullName} <span className="text-slate-500">· {g.relationship}{g.phone ? ` · ${g.phone}` : ''}</span></li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-400">{patient.age !== null && patient.age < 18 ? 'Menor de edad sin representante registrado' : 'No aplica'}</p>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Anamnesis</h3>
          {canEdit && !editMed && <button className="btn-secondary !py-1 text-xs" onClick={() => { setMed(medicalFromHistory(h)); setEditMed(true); }}><Icon name="edit" size={14} /> Actualizar</button>}
        </div>
        {editMed ? (
          <form onSubmit={saveMedical} className="space-y-3">
            <MedicalHistoryFields value={med} onChange={setMed} showPregnancy={patient.gender !== 'MALE'} />
            <div>
              <label className="label">Alertas manuales adicionales</label>
              <input value={manualAlerts} onChange={(e) => setManualAlerts(e.target.value)} placeholder="Ej: Requiere profilaxis antibiótica" />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary">Guardar anamnesis</button>
              <button type="button" className="btn-secondary" onClick={() => setEditMed(false)}>Cancelar</button>
            </div>
          </form>
        ) : (
          <>
            {row('Alergias', h.allergies?.join(', '))}
            {row('Medicación', h.medications?.join(', '))}
            {row('Enfermedades', h.systemicDiseases?.join(', '))}
            {row('Cirugías', h.surgicalHistory?.join(', '))}
            {row('Hábitos', h.habits?.join(', '))}
            {row('Coagulación', [h.anticoagulated && 'Anticoagulado', h.bleedingDisorder && 'Coagulopatía'].filter(Boolean).join(', ') || 'Sin alteraciones')}
            {h.isPregnant && row('Embarazo', `${h.pregnancyWeeks ?? '?'} semanas`)}
            <p className="mt-3 text-xs text-slate-400">Última revisión: {fmtDateTime(h.reviewedAt || h.updatedAt)}</p>
          </>
        )}
      </section>

      {timeline && (
        <section className="card p-5 lg:col-span-2">
          <h3 className="mb-3 font-semibold">Línea de tiempo del expediente</h3>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">Sin eventos.</p>
          ) : (
            <ol className="max-h-96 overflow-y-auto pl-1">
              {timeline.slice(0, 60).map((ev, i) => (
                <li key={i} className="relative border-l border-line pb-4 pl-5 text-[13.5px] last:pb-0">
                  <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                  <span className="text-xs text-slate-400">{fmtDateTime(ev.date)}</span>
                  <div className="font-semibold">{ev.title}</div>
                  {ev.detail && <div className="text-xs text-slate-500">{ev.detail}</div>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <Modal open={editInfo} title="Editar datos del paciente" onClose={() => setEditInfo(false)} width="max-w-2xl">
        <form onSubmit={saveInfo} className="grid gap-3 sm:grid-cols-2">
          {editable.map((k) => (
            <div key={k} className={k === 'notes' || k === 'address' ? 'sm:col-span-2' : ''}>
              <label className="label">{labels[k]}</label>
              <input value={info[k] ?? ''} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} />
            </div>
          ))}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditInfo(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!guardian} title="Agregar representante legal" onClose={() => setGuardian(null)}>
        {guardian && (
          <form onSubmit={addGuardian} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Nombre completo *</label><input value={guardian.fullName} onChange={(e) => setGuardian({ ...guardian, fullName: e.target.value })} required /></div>
            <div><label className="label">Parentesco *</label><input value={guardian.relationship} onChange={(e) => setGuardian({ ...guardian, relationship: e.target.value })} required /></div>
            <div><label className="label">Cédula</label><input value={guardian.documentNumber} onChange={(e) => setGuardian({ ...guardian, documentNumber: e.target.value })} /></div>
            <div><label className="label">Celular</label><input value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} /></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary">Agregar</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ Notas SOEP */
function NotesTab({ patientId, appointments }: { patientId: string; appointments: any[] }) {
  const me = getUser();
  const [notes, setNotes] = useState<any[] | null>(null);
  const [form, setForm] = useState({ subjective: '', objective: '', assessment: '', plan: '', appointmentId: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [addendumFor, setAddendumFor] = useState<string | null>(null);
  const [addendum, setAddendum] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api(`/clinical-notes/patient/${patientId}`).then(setNotes).catch((e) => setError(e.message)), [patientId]);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/clinical-notes', { method: 'POST', body: JSON.stringify({ patientId, ...Object.fromEntries(Object.entries(form).filter(([, v]) => v)) }) });
      setForm({ subjective: '', objective: '', assessment: '', plan: '', appointmentId: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  const act = async (fn: () => Promise<any>) => {
    setError('');
    try {
      await fn();
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const top = (notes || []).filter((n) => !n.parentNoteId);
  const addendaOf = (id: string) => (notes || []).filter((n) => n.parentNoteId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const S = [['subjective', 'S — Subjetivo'], ['objective', 'O — Objetivo'], ['assessment', 'E — Evaluación'], ['plan', 'P — Plan']] as const;

  return (
    <div className="space-y-4">
      <ErrorBox error={error} onClose={() => setError('')} />
      <form onSubmit={create} className="card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Nueva nota de evolución (SOEP)</h3>
          <select className="!w-auto text-sm" value={form.appointmentId} onChange={(e) => setForm({ ...form, appointmentId: e.target.value })}>
            <option value="">Sin cita asociada</option>
            {appointments.map((a) => <option key={a.id} value={a.id}>{fmtDateTime(a.startAt)} · {a.reason}</option>)}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {S.map(([k, l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <textarea className="min-h-[80px]" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">La nota podrá editarse hasta que la firme o se cumpla el plazo de bloqueo de la clínica; luego solo admite adendas.</p>
          <button className="btn-primary shrink-0" disabled={saving}>Guardar nota</button>
        </div>
      </form>

      {!notes ? <Spinner /> : top.length === 0 ? <Empty>Sin notas registradas</Empty> : null}
      {top.map((n) => {
        const mine = n.authorId === me?.id;
        const editable = mine && !n.isLocked;
        return (
          <article key={n.id} className="card p-5 text-sm">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{n.author ? `${n.author.firstName} ${n.author.lastName}` : 'Profesional'}</span>
                <span className="ml-2 text-xs text-slate-400">{fmtDateTime(n.createdAt)}{n.appointment ? ` · ${n.appointment.reason}` : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {n.signedAt ? (
                  <Badge cls="bg-emerald-50 text-emerald-700 ring-emerald-600/20"><Icon name="lock" size={12} /> Firmada {fmtDateTime(n.signedAt)}</Badge>
                ) : n.isLocked ? (
                  <Badge cls="bg-slate-100 text-slate-600 ring-slate-500/20"><Icon name="lock" size={12} /> Bloqueada por plazo</Badge>
                ) : (
                  <Badge cls="bg-amber-50 text-amber-700 ring-amber-600/20">Editable hasta {fmtDateTime(n.lockAt)}</Badge>
                )}
                {editable && hasRole('DENTIST') && <button className="text-xs font-semibold text-brand-700" onClick={() => act(() => api(`/clinical-notes/${n.id}/sign`, { method: 'PATCH' }))}>Firmar</button>}
                {editable && <button className="text-xs font-semibold text-slate-600" onClick={() => { setEditing(n.id); setEditForm({ subjective: n.subjective || '', objective: n.objective || '', assessment: n.assessment || '', plan: n.plan || '' }); }}>Editar</button>}
                {n.isLocked && hasRole('DENTIST') && <button className="text-xs font-semibold text-purple-700" onClick={() => { setAddendumFor(n.id); setAddendum(''); }}>Adenda</button>}
              </div>
            </header>
            {editing === n.id ? (
              <form onSubmit={(e) => { e.preventDefault(); act(() => api(`/clinical-notes/${n.id}`, { method: 'PATCH', body: JSON.stringify(editForm) })).then(() => setEditing(null)); }} className="space-y-2">
                {S.map(([k, l]) => (
                  <div key={k}><label className="label">{l}</label><textarea value={editForm[k]} onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value })} /></div>
                ))}
                <div className="flex gap-2"><button className="btn-primary !py-1">Guardar</button><button type="button" className="btn-secondary !py-1" onClick={() => setEditing(null)}>Cancelar</button></div>
              </form>
            ) : (
              <div className="space-y-1 text-slate-700">
                {n.subjective && <p><strong>S:</strong> {n.subjective}</p>}
                {n.objective && <p><strong>O:</strong> {n.objective}</p>}
                {n.assessment && <p><strong>E:</strong> {n.assessment}</p>}
                {n.plan && <p><strong>P:</strong> {n.plan}</p>}
                {n.content && <p className="text-slate-600">{n.content}</p>}
              </div>
            )}
            {n.signatureHash && <p className="mt-2 font-mono text-[10px] text-slate-400">Huella de firma SHA-256: {n.signatureHash.slice(0, 24)}…</p>}
            {addendaOf(n.id).map((a) => (
              <div key={a.id} className="mt-3 rounded-lg border-l-4 border-purple-400 bg-purple-50/60 px-3 py-2">
                <div className="text-xs font-semibold text-purple-800">Adenda · {a.author?.firstName} {a.author?.lastName} · {fmtDateTime(a.createdAt)}</div>
                <p className="text-slate-700">{a.content}</p>
              </div>
            ))}
            {addendumFor === n.id && (
              <form onSubmit={(e) => { e.preventDefault(); act(() => api(`/clinical-notes/${n.id}/addendum`, { method: 'POST', body: JSON.stringify({ content: addendum }) })).then(() => setAddendumFor(null)); }} className="mt-3 space-y-2">
                <textarea placeholder="Corrección o información adicional (quedará firmada)" value={addendum} onChange={(e) => setAddendum(e.target.value)} required />
                <div className="flex gap-2"><button className="btn-primary !py-1">Firmar adenda</button><button type="button" className="btn-secondary !py-1" onClick={() => setAddendumFor(null)}>Cancelar</button></div>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Presupuestos */
function PlansTab({ patientId }: { patientId: string }) {
  const [plans, setPlans] = useState<any[] | null>(null);
  useEffect(() => {
    api(`/treatment-plans?patientId=${patientId}`).then(setPlans).catch(() => setPlans([]));
  }, [patientId]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {hasRole('DENTIST') && <Link href={`/treatment-plans?new=1&patientId=${patientId}`} className="btn-primary"><Icon name="plus" size={18} /> Nuevo presupuesto</Link>}
      </div>
      {!plans ? <Spinner /> : plans.length === 0 ? <Empty>Sin presupuestos</Empty> : plans.map((p) => (
        <Link key={p.id} href={`/treatment-plans?open=${p.id}`} className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-semibold">{p.title}</div>
            <div className="text-xs text-slate-500">{fmtDate(p.createdAt)} · {plural(p.items.length, 'ítem')} · {plural(p.totals.phases.length, 'fase')}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge cls={PLAN_STATUS[p.status]?.cls}>{PLAN_STATUS[p.status]?.label}</Badge>
            <span className="font-semibold tabular-nums">{money(p.totals.total)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Consentimientos */
function ConsentsTab({ patient }: { patient: any }) {
  const [list, setList] = useState<any[] | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [free, setFree] = useState({ title: '', body: '' });
  const [signing, setSigning] = useState<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [otp, setOtp] = useState<{ sentTo?: string; devCode?: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/consents/patient/${patient.id}`).then(setList).catch((e) => setError(e.message)), [patient.id]);
  useEffect(() => {
    load();
    api('/consents/templates').then(setTemplates).catch(() => {});
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/consents', { method: 'POST', body: JSON.stringify(templateId ? { patientId: patient.id, templateId } : { patientId: patient.id, title: free.title, contentSnapshot: `<p>${free.body.replace(/</g, '&lt;')}</p>` }) });
      setTemplateId('');
      setFree({ title: '', body: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function sendOtp() {
    setError('');
    try {
      setOtp(await api(`/consents/${signing.id}/otp`, { method: 'POST' }));
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function sign() {
    setBusy(true);
    setError('');
    try {
      await api(`/consents/${signing.id}/sign`, { method: 'PATCH', body: JSON.stringify({ ...(signature ? { signatureData: signature } : {}), ...(otpCode ? { otpCode } : {}) }) });
      setSigning(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function print(c: any) {
    openPrint(c.title, `
      <div class="head"><div><h1>${escapeHtml(c.title)}</h1><div class="muted">${escapeHtml(getUser()?.clinicName)}</div></div><div class="muted">${fmtDateTime(c.createdAt)}</div></div>
      ${sanitizeHtml(c.contentSnapshot)}
      <div class="sign"><div>${c.signatureData?.startsWith('data:image') ? `<img class="sig" src="${c.signatureData}">` : ''}Firma del paciente / representante<br><span class="muted">${c.status === 'SIGNED' ? `Firmado ${fmtDateTime(c.signedAt)}${c.otpVerified ? ' · verificado con OTP' : ''}` : 'Pendiente de firma'}</span></div><div>Profesional tratante</div></div>`);
  }

  return (
    <div className="space-y-4">
      <ErrorBox error={!signing ? error : ''} onClose={() => setError('')} />
      <form onSubmit={create} className="card p-5 space-y-3">
        <h3 className="font-semibold">Generar consentimiento</h3>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Texto libre…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {!templateId && (
          <>
            <input placeholder="Título" value={free.title} onChange={(e) => setFree({ ...free, title: e.target.value })} required />
            <textarea placeholder="Texto del consentimiento" value={free.body} onChange={(e) => setFree({ ...free, body: e.target.value })} required />
          </>
        )}
        <button className="btn-primary">Generar</button>
      </form>

      {!list ? <Spinner /> : list.length === 0 ? <Empty>Sin consentimientos</Empty> : list.map((c) => (
        <div key={c.id} className="card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-slate-500">
                {c.status === 'SIGNED' ? `Firmado ${fmtDateTime(c.signedAt)}${c.otpVerified ? ' · OTP verificado' : ''}${c.signatureData?.startsWith('data:image') ? ' · firma manuscrita' : ''}` : `Generado ${fmtDateTime(c.createdAt)}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge cls={c.status === 'SIGNED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : c.status === 'REVOKED' ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'}>
                {c.status === 'SIGNED' ? 'Firmado' : c.status === 'REVOKED' ? 'Revocado' : 'Pendiente'}
              </Badge>
              {c.status === 'PENDING' && <button className="btn-primary !py-1 text-xs" onClick={() => { setSigning(c); setSignature(null); setOtp(null); setOtpCode(''); setError(''); }}><Icon name="pen" size={14} /> Firmar</button>}
              <button className="btn-secondary !py-1 text-xs" onClick={() => print(c)}><Icon name="print" size={14} /></button>
              {c.status === 'SIGNED' && <button className="text-xs font-semibold text-red-600" onClick={() => confirm('¿Revocar este consentimiento?') && api(`/consents/${c.id}/revoke`, { method: 'PATCH' }).then(load)}>Revocar</button>}
            </div>
          </div>
        </div>
      ))}

      <Modal open={!!signing} title={signing?.title || ''} onClose={() => setSigning(null)} width="max-w-2xl">
        {signing && (
          <div className="space-y-4">
            <ErrorBox error={error} />
            <div className="max-h-64 overflow-y-auto rounded-lg bg-slate-50 p-4 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(signing.contentSnapshot) }} />
            <div>
              <label className="label">Firma del paciente o representante</label>
              <SignaturePad onChange={setSignature} />
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Validación OTP</span>
                <button type="button" className="btn-secondary !py-1 text-xs" onClick={sendOtp}>{otp ? 'Reenviar código' : 'Enviar código al celular'}</button>
                {otp && <span className="text-xs text-slate-500">Enviado a {otp.sentTo}{otp.devCode ? ` · (modo prueba: ${otp.devCode})` : ''}</span>}
              </div>
              {otp && <input className="mt-2 !w-40 text-center tracking-widest" maxLength={6} placeholder="Código" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} />}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setSigning(null)}>Cancelar</button>
              <button className="btn-primary" disabled={busy || (!signature && otpCode.length !== 6)} onClick={sign}>Registrar firma</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ Recetas */
function RxTab({ patient }: { patient: any }) {
  const me = getUser();
  const [list, setList] = useState<any[] | null>(null);
  const emptyItem = { medication: '', dose: '', frequency: '', duration: '', notes: '' };
  const [form, setForm] = useState({ diagnosis: '', indications: '', items: [{ ...emptyItem }] });
  const [conflict, setConflict] = useState<string | null>(null);
  const [error, setError] = useState('');
  const canWrite = hasRole('DENTIST');

  const load = useCallback(() => api(`/prescriptions/patient/${patient.id}`).then(setList).catch((e) => setError(e.message)), [patient.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function submit(override = false) {
    setError('');
    try {
      await api('/prescriptions', { method: 'POST', body: JSON.stringify({ patientId: patient.id, diagnosis: form.diagnosis || undefined, indications: form.indications || undefined, items: form.items.filter((i) => i.medication), overrideAllergy: override || undefined }) });
      setForm({ diagnosis: '', indications: '', items: [{ ...emptyItem }] });
      setConflict(null);
      load();
    } catch (err: any) {
      if (err.code === 'ALLERGY_CONFLICT') setConflict(err.message);
      else setError(err.message);
    }
  }
  function print(r: any) {
    openPrint('Receta', `
      <div class="head"><div><h1>Receta odontológica</h1><div class="muted">${escapeHtml(me?.clinicName)}</div></div><div class="muted">${fmtDateTime(r.createdAt)}</div></div>
      <p><strong>Paciente:</strong> ${escapeHtml(fullName(patient))} · ${escapeHtml(patient.documentNumber)}${patient.age !== null ? ` · ${patient.age} años` : ''}</p>
      ${patient.medicalHistory?.allergies?.length ? `<p><strong>Alergias:</strong> ${escapeHtml(patient.medicalHistory.allergies.join(', '))}</p>` : ''}
      ${r.diagnosis ? `<p><strong>Diagnóstico:</strong> ${escapeHtml(r.diagnosis)}</p>` : ''}
      <table><thead><tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th><th>Indicaciones</th></tr></thead><tbody>
      ${(r.items || []).map((i: any) => `<tr><td><strong>${escapeHtml(i.medication)}</strong></td><td>${escapeHtml(i.dose)}</td><td>${escapeHtml(i.frequency)}</td><td>${escapeHtml(i.duration)}</td><td>${escapeHtml(i.notes)}</td></tr>`).join('')}
      </tbody></table>
      ${r.indications ? `<h2>Indicaciones</h2><p>${escapeHtml(r.indications).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="sign"><div>${r.dentist ? `Dr(a). ${escapeHtml(r.dentist.firstName)} ${escapeHtml(r.dentist.lastName)}` : 'Profesional'}<br><span class="muted">${r.isSigned ? `Firmada electrónicamente ${fmtDateTime(r.signedAt)}` : 'Sin firmar'}</span></div></div>`);
  }
  const setItem = (i: number, k: string, v: string) => setForm({ ...form, items: form.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });

  return (
    <div className="space-y-4">
      <ErrorBox error={error} onClose={() => setError('')} />
      {canWrite && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="card p-5 space-y-3">
          <h3 className="font-semibold">Nueva receta</h3>
          {patient.medicalHistory?.allergies?.length > 0 && <Notice tone="warn">Alergias registradas: <strong>{patient.medicalHistory.allergies.join(', ')}</strong>. El sistema bloquea medicamentos de la misma familia.</Notice>}
          <input placeholder="Diagnóstico" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          {form.items.map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <input placeholder="Medicamento y concentración *" value={it.medication} onChange={(e) => setItem(i, 'medication', e.target.value)} required={i === 0} />
              <input placeholder="Dosis" value={it.dose} onChange={(e) => setItem(i, 'dose', e.target.value)} />
              <input placeholder="Frecuencia" value={it.frequency} onChange={(e) => setItem(i, 'frequency', e.target.value)} />
              <input placeholder="Duración" value={it.duration} onChange={(e) => setItem(i, 'duration', e.target.value)} />
              <button type="button" className="btn-secondary !px-2" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} aria-label="Quitar"><Icon name="close" size={16} /></button>
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>+ Agregar medicamento</button>
          <textarea placeholder="Indicaciones generales" value={form.indications} onChange={(e) => setForm({ ...form, indications: e.target.value })} />
          {conflict && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <strong>{conflict}</strong>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-danger !py-1 text-xs" onClick={() => submit(true)}>Prescribir de todas formas (queda registrado)</button>
                <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setConflict(null)}>Cambiar medicamento</button>
              </div>
            </div>
          )}
          <button className="btn-primary">Guardar receta</button>
        </form>
      )}
      {!list ? <Spinner /> : list.length === 0 ? <Empty>Sin recetas</Empty> : list.map((r) => (
        <div key={r.id} className="card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{r.diagnosis || 'Receta'}</div>
              <div className="text-xs text-slate-500">{fmtDateTime(r.createdAt)}{r.dentist ? ` · ${drName(r.dentist)}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.isSigned ? <Badge cls="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Firmada</Badge> : r.dentistId === me?.id ? (
                <button className="btn-primary !py-1 text-xs" onClick={() => api(`/prescriptions/${r.id}/sign`, { method: 'PATCH' }).then(load).catch((e) => setError(e.message))}>Firmar</button>
              ) : <Badge>Sin firmar</Badge>}
              <button className="btn-secondary !py-1 text-xs" onClick={() => print(r)}><Icon name="print" size={14} /> Imprimir</button>
            </div>
          </div>
          <ul className="mt-2 space-y-0.5 text-slate-700">
            {(r.items || []).map((it: any, i: number) => <li key={i}><strong>{it.medication}</strong>{it.dose ? ` — ${it.dose}` : ''}{it.frequency ? ` · ${it.frequency}` : ''}{it.duration ? ` · ${it.duration}` : ''}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Citas y pagos */
function BillingTab({ patient }: { patient: any }) {
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const canBill = hasRole('RECEPTIONIST', 'ACCOUNTANT');
  useEffect(() => {
    if (canBill) api(`/invoices?patientId=${patient.id}`).then(setInvoices).catch(() => setInvoices([]));
  }, [patient.id, canBill]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5">
        <h3 className="mb-3 font-semibold">Últimas citas</h3>
        {!patient.appointments?.length ? <p className="text-sm text-slate-400">Sin citas.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {patient.appointments.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                <div><div className="font-medium">{a.reason || 'Cita'}</div><div className="text-xs text-slate-500">{fmtDateTime(a.startAt)} · {drName(a.dentist)}{a.room ? ` · ${a.room.name}` : ''}</div></div>
                <Badge cls={APPT_STATUS[a.status]?.cls}>{APPT_STATUS[a.status]?.label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      {canBill && (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Facturas</h3><Link href={`/invoices?patientId=${patient.id}`} className="text-sm font-semibold text-brand-700">Ir a caja →</Link></div>
          {!invoices ? <Spinner /> : invoices.length === 0 ? <p className="text-sm text-slate-400">Sin facturas.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <div><div className="font-medium tabular-nums">{i.number || 'Borrador'}</div><div className="text-xs text-slate-500">{fmtDate(i.issuedAt || i.createdAt)} · pagado {money(i.paidAmount)}</div></div>
                  <div className="flex items-center gap-2"><Badge cls={INVOICE_STATUS[i.status]?.cls}>{INVOICE_STATUS[i.status]?.label}</Badge><span className="font-semibold tabular-nums">{money(i.total)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

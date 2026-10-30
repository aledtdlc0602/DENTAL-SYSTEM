'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import MedicalHistoryFields, { emptyMedical, medicalPayload, MedicalForm } from '@/components/MedicalHistoryFields';
import { AlertBadges, Empty, ErrorBox, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, hasRole } from '@/lib/api';
import { fmtDate } from '@/lib/format';

const emptyForm = {
  documentType: 'CEDULA', documentNumber: '', firstName: '', lastName: '', gender: '', birthDate: '', phone: '', email: '',
  address: '', city: 'Quito', occupation: '', emergencyContactName: '', emergencyContactPhone: '', insuranceName: '', insuranceNumber: '',
  guardianName: '', guardianDocument: '', guardianRelationship: 'Madre', guardianPhone: '',
};

function ageOf(birth: string) {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [medical, setMedical] = useState<MedicalForm>({ ...emptyMedical });
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const canCreate = hasRole('DENTIST', 'ASSISTANT', 'RECEPTIONIST');

  async function load(q = search, p = page) {
    setLoading(true);
    try {
      const data = await api(`/patients?search=${encodeURIComponent(q)}&limit=25&page=${p}`);
      setPatients(data.data || []);
      setMeta(data.meta);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(search, page), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const age = ageOf(form.birthDate);
  const minor = age !== null && age < 18;
  const set = (k: keyof typeof emptyForm, v: string) => setForm({ ...form, [k]: v });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const body: any = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      if (!minor) {
        delete body.guardianName;
        delete body.guardianDocument;
        delete body.guardianRelationship;
        delete body.guardianPhone;
      }
      const created = await api('/patients', { method: 'POST', body: JSON.stringify({ ...body, ...medicalPayload(medical) }) });
      setShow(false);
      setForm({ ...emptyForm });
      setMedical({ ...emptyMedical });
      window.location.href = `/patients/${created.id}`;
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Pacientes"
        subtitle={`${meta.total} pacientes registrados`}
        actions={canCreate && <button className="btn-primary" onClick={() => setShow(true)}><Icon name="plus" size={18} /> Nuevo paciente</button>}
      />

      <div className="relative mb-4 max-w-md">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="!pl-10" placeholder="Buscar por nombre, cédula, teléfono o email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <ErrorBox error={error} onClose={() => setError('')} />

      {loading ? (
        <Spinner />
      ) : patients.length === 0 ? (
        <Empty>No se encontraron pacientes</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-4 py-3">Paciente</th>
                <th className="text-left px-4 py-3">Documento</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Teléfono</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Nacimiento</th>
                <th className="text-left px-4 py-3">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/patients/${p.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {p.lastName}, {p.firstName}
                    </Link>
                    {p.tags?.length > 0 && <div className="text-[11px] text-slate-400">{p.tags.join(' · ')}</div>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.documentNumber}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{p.phone || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">{fmtDate(p.birthDate)}</td>
                  <td className="px-4 py-3"><AlertBadges alerts={p.medicalHistory?.alerts} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-500">Página {meta.page} de {meta.totalPages}</span>
              <div className="flex gap-2">
                <button className="btn-secondary !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="chevron-left" size={16} /></button>
                <button className="btn-secondary !py-1" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}><Icon name="chevron-right" size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={show} title="Nuevo paciente" onClose={() => setShow(false)} width="max-w-3xl">
        <form onSubmit={handleCreate} className="space-y-5">
          <ErrorBox error={formError} />
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Tipo documento</label>
              <select value={form.documentType} onChange={(e) => set('documentType', e.target.value)}>
                <option value="CEDULA">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="RUC">RUC</option>
              </select>
            </div>
            <div>
              <label className="label">Número *</label>
              <input value={form.documentNumber} onChange={(e) => set('documentNumber', e.target.value.trim())} required />
            </div>
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Nombres *</label>
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
            </div>
            <div>
              <label className="label">Apellidos *</label>
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
            </div>
            <div>
              <label className="label">Sexo</label>
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">—</option>
                <option value="FEMALE">Femenino</option>
                <option value="MALE">Masculino</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">Celular</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="09XXXXXXXX" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="label">Ocupación</label>
              <input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div>
              <label className="label">Ciudad</label>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
          </fieldset>

          {minor && (
            <fieldset className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <legend className="px-1 text-sm font-semibold text-amber-800">Representante legal (obligatorio: paciente de {age} años)</legend>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="label">Nombre completo *</label>
                  <input value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Parentesco</label>
                  <select value={form.guardianRelationship} onChange={(e) => set('guardianRelationship', e.target.value)}>
                    {['Madre', 'Padre', 'Tutor legal', 'Abuelo/a', 'Otro'].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cédula</label>
                  <input value={form.guardianDocument} onChange={(e) => set('guardianDocument', e.target.value)} />
                </div>
                <div>
                  <label className="label">Celular</label>
                  <input value={form.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} />
                </div>
              </div>
            </fieldset>
          )}

          <fieldset className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Contacto de emergencia</label>
              <input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono emergencia</label>
              <input value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} />
            </div>
            <div>
              <label className="label">Seguro / convenio</label>
              <input value={form.insuranceName} onChange={(e) => set('insuranceName', e.target.value)} />
            </div>
            <div>
              <label className="label">N.º de póliza</label>
              <input value={form.insuranceNumber} onChange={(e) => set('insuranceNumber', e.target.value)} />
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Anamnesis</legend>
            <MedicalHistoryFields value={medical} onChange={setMedical} showPregnancy={form.gender !== 'MALE' && !minor} />
          </fieldset>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShow(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Registrar paciente'}</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

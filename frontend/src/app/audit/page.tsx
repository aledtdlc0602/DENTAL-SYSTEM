'use client';

import { Fragment, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import { Badge, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLE_LABELS, addDays, dateKey, plural } from '@/lib/format';

const ACTION_CLS: Record<string, string> = {
  VIEW: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  CREATE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  UPDATE: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  DELETE: 'bg-red-50 text-red-700 ring-red-600/20',
  SIGN: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  LOGIN: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  LOGIN_FAILED: 'bg-red-50 text-red-700 ring-red-600/20',
  EXPORT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

export default function AuditPage() {
  const [filters, setFilters] = useState({ action: '', entity: '', userId: '', from: dateKey(addDays(new Date(), -7)), to: dateKey() });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/users').then(setUsers).catch(() => {});
  }, []);
  useEffect(() => {
    setRes(null);
    const qs = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    api(`/audit?${qs}`).then(setRes).catch((e) => setError(e.message));
  }, [filters, page]);

  const set = (k: string, v: string) => { setPage(1); setFilters({ ...filters, [k]: v }); };

  return (
    <AppShell roles={[]}>
      <PageHeader title="Auditoría" subtitle="Registro permanente de quién consultó, modificó, firmó o exportó información, con fecha, hora e IP de origen." />
      <ErrorBox error={error} />
      <div className="card mb-4 grid gap-2 p-3 sm:grid-cols-5">
        <select value={filters.action} onChange={(e) => set('action', e.target.value)}>
          <option value="">Todas las acciones</option>
          {['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'SIGN', 'ADDENDUM', 'STATUS_CHANGE', 'PAYMENT', 'ISSUE', 'EXPORT', 'CASH_CLOSE', 'LOGIN', 'LOGIN_FAILED', 'MFA_ENABLED'].map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={filters.entity} onChange={(e) => set('entity', e.target.value)}>
          <option value="">Todas las entidades</option>
          {['Patient', 'Appointment', 'ClinicalNote', 'Odontogram', 'Periodontogram', 'Consent', 'Prescription', 'TreatmentPlan', 'Invoice', 'Inventory', 'User', 'Settings'].map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={filters.userId} onChange={(e) => set('userId', e.target.value)}>
          <option value="">Todos los usuarios</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
      </div>
      {!res ? <Spinner /> : res.data.length === 0 ? <Empty>Sin registros</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-3 py-2 text-left">Fecha (ISO-8601)</th><th className="px-3 py-2 text-left">Usuario</th><th className="px-3 py-2 text-left">Acción</th><th className="px-3 py-2 text-left">Entidad</th><th className="px-3 py-2 text-left">IP</th><th /></tr></thead>
            <tbody>
              {res.data.map((l: any) => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs">{new Date(l.createdAt).toISOString()}</td>
                    <td className="px-3 py-2">{l.user ? <>{l.user.firstName} {l.user.lastName} <span className="text-xs text-slate-400">· {ROLE_LABELS[l.user.role] || l.user.role}</span></> : '—'}</td>
                    <td className="px-3 py-2"><Badge cls={ACTION_CLS[l.action]}>{l.action}</Badge></td>
                    <td className="px-3 py-2">{l.entity}{l.entityId ? <span className="ml-1 font-mono text-[11px] text-slate-400">{l.entityId.slice(0, 10)}…</span> : ''}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.ipAddress || '—'}</td>
                    <td className="px-3 py-2 text-right">{(l.newData || l.userAgent) && <button className="text-xs font-semibold text-brand-700" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? 'Ocultar' : 'Ver'}</button>}</td>
                  </tr>
                  {open === l.id && (
                    <tr><td colSpan={6} className="bg-slate-50 px-3 py-2"><div className="text-xs text-slate-500">{l.userAgent}</div><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(l.newData, null, 2)}</pre></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">{plural(res.meta.total, 'registro')} · página {res.meta.page} de {res.meta.totalPages || 1}</span>
            <div className="flex gap-2">
              <button className="btn-secondary !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="chevron-left" size={16} /></button>
              <button className="btn-secondary !py-1" disabled={page >= res.meta.totalPages} onClick={() => setPage(page + 1)}><Icon name="chevron-right" size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

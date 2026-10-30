'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import { Empty, ErrorBox, Modal, PageHeader, Spinner, StatStrip, Tabs } from '@/components/ui';
import { api, getUser, hasRole } from '@/lib/api';
import { addDays, dateKey, fmtDate, money } from '@/lib/format';

const RULE_TYPES: Record<string, string> = {
  PERCENT_GROSS: '% sobre el valor cobrado',
  PERCENT_AFTER_COST: '% después de laboratorio y materiales',
  FIXED_AMOUNT: 'Monto fijo por procedimiento',
};

export default function CommissionsPage() {
  const me = getUser();
  const isDentist = me?.role === 'DENTIST';
  const [tab, setTab] = useState<'settlement' | 'summary' | 'rules'>(isDentist ? 'settlement' : 'summary');
  const [from, setFrom] = useState(dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(dateKey());
  const [dentists, setDentists] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [dentistId, setDentistId] = useState(isDentist ? me!.id : '');
  const [settlement, setSettlement] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [rules, setRules] = useState<any[] | null>(null);
  const [newRule, setNewRule] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/users/dentists').then((d) => { setDentists(d); if (!dentistId && d[0]) setDentistId(d[0].id); }).catch(() => {});
    api('/procedures').then(setProcedures).catch(() => {});
    api('/commissions/rules').then(setRules).catch(() => setRules([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setError('');
    setLoading(true);
    const p = tab === 'summary' && !isDentist
      ? api(`/commissions/settlement/all?from=${from}&to=${to}`).then(setSummary)
      : tab === 'settlement' && dentistId
        ? api(`/commissions/settlement?dentistId=${dentistId}&from=${from}&to=${to}`).then(setSettlement)
        : Promise.resolve();
    p.catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [tab, from, to, dentistId, isDentist]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/commissions/rules', { method: 'POST', body: JSON.stringify({ ...newRule, value: Number(newRule.value), procedureId: newRule.procedureId || undefined, dentistId: newRule.dentistId || undefined }) });
      setNewRule(null);
      setRules(await api('/commissions/rules'));
    } catch (err: any) {
      setError(err.message);
    }
  }

  const name = (list: any[], id: string, f: (x: any) => string) => (id ? f(list.find((x) => x.id === id) || {}) : 'Todos');

  return (
    <AppShell roles={['ACCOUNTANT', 'DENTIST']}>
      <PageHeader title="Honorarios profesionales" subtitle="Liquidación por profesional según las reglas de la clínica: porcentaje, monto fijo o porcentaje después de laboratorio y materiales." />
      <ErrorBox error={error} onClose={() => setError('')} />
      <Tabs
        tabs={[...(!isDentist ? [{ id: 'summary' as const, label: 'Resumen del período' }] : []), { id: 'settlement' as const, label: isDentist ? 'Mi liquidación' : 'Liquidación por odontólogo' }, { id: 'rules' as const, label: 'Reglas' }]}
        value={tab}
        onChange={setTab}
      />
      {tab !== 'rules' && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div><label className="label">Desde</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">Hasta</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <button className="btn-secondary" onClick={() => { setFrom(dateKey(addDays(new Date(), -30))); setTo(dateKey()); }}>Últimos 30 días</button>
          {tab === 'settlement' && !isDentist && (
            <div><label className="label">Odontólogo</label><select value={dentistId} onChange={(e) => setDentistId(e.target.value)}>{dentists.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}</select></div>
          )}
        </div>
      )}

      {tab === 'summary' && (loading || !summary ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-4 py-3 text-left">Odontólogo</th><th className="px-4 py-3 text-right">Atenciones</th><th className="px-4 py-3 text-right">Producción</th><th className="px-4 py-3 text-right">Laboratorio</th><th className="px-4 py-3 text-right">Materiales</th><th className="px-4 py-3 text-right">Honorarios</th><th /></tr></thead>
            <tbody>
              {summary.rows.map((r: any) => (
                <tr key={r.dentistId}>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td><td className="px-4 text-right tabular-nums">{r.appointments}</td><td className="px-4 text-right tabular-nums">{money(r.gross)}</td><td className="px-4 text-right tabular-nums">{money(r.labCost)}</td><td className="px-4 text-right tabular-nums">{money(r.materialsCost)}</td><td className="px-4 text-right font-semibold tabular-nums">{money(r.commission)}</td>
                  <td className="px-4 text-right"><button className="text-xs font-semibold text-brand-700" onClick={() => { setDentistId(r.dentistId); setTab('settlement'); }}>Detalle</button></td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="px-4 py-3">Total</td><td className="px-4 text-right">{summary.totals.appointments}</td><td className="px-4 text-right tabular-nums">{money(summary.totals.gross)}</td><td /><td /><td className="px-4 text-right tabular-nums">{money(summary.totals.commission)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'settlement' && (loading || !settlement ? <Spinner /> : (
        <>
          <div className="mb-4">
            <StatStrip
              items={[
                { label: 'Producción', value: money(settlement.gross), hint: `${settlement.appointmentsCount} atenciones` },
                { label: 'Laboratorio y materiales', value: money(settlement.labCost + settlement.materialsCost) },
                { label: 'Honorarios a pagar', value: money(settlement.commissionTotal) },
                { label: 'Neto para la clínica', value: money(settlement.clinicNet) },
              ]}
            />
          </div>
          <div className="mb-4 flex justify-end"><button className="btn-secondary" onClick={() => window.print()}><Icon name="print" size={16} /> Imprimir liquidación</button></div>
          {settlement.lines.length === 0 ? <Empty>Sin atenciones completadas en el período</Empty> : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Paciente</th><th className="px-3 py-2 text-left">Procedimiento</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-right">Costos</th><th className="px-3 py-2 text-left">Regla</th><th className="px-3 py-2 text-right">Honorario</th></tr></thead>
                <tbody>
                  {settlement.lines.map((l: any) => (
                    <tr key={l.appointmentId}><td className="px-3 py-2">{fmtDate(l.date)}</td><td className="px-3 py-2">{l.patient}</td><td className="px-3 py-2">{l.procedure}</td><td className="px-3 py-2 text-right tabular-nums">{money(l.amount)}</td><td className="px-3 py-2 text-right tabular-nums text-slate-500">{money(l.labCost + l.materialsCost)}</td><td className="px-3 py-2 text-xs text-slate-500">{l.ruleName}<br />{l.ruleType === 'FIXED_AMOUNT' ? money(l.ruleValue) : `${l.ruleValue}%`}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{money(l.commission)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ))}

      {tab === 'rules' && (
        <>
          {hasRole() && <div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setNewRule({ name: '', type: 'PERCENT_GROSS', value: 40, procedureId: '', dentistId: '' })}><Icon name="plus" size={18} /> Nueva regla</button></div>}
          <p className="mb-3 text-sm text-slate-500">Prioridad al liquidar: odontólogo + procedimiento → procedimiento → odontólogo → regla general (40% si no hay ninguna).</p>
          {!rules ? <Spinner /> : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><th className="px-4 py-3 text-left">Regla</th><th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-left">Odontólogo</th><th className="px-4 py-3 text-left">Procedimiento</th></tr></thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}><td className="px-4 py-2.5 font-medium">{r.name}</td><td className="px-4 text-slate-600">{RULE_TYPES[r.type]}</td><td className="px-4 text-right tabular-nums">{r.type === 'FIXED_AMOUNT' ? money(r.value) : `${Number(r.value)}%`}</td><td className="px-4">{name(dentists, r.dentistId, (d) => `${d.firstName ?? ''} ${d.lastName ?? ''}`)}</td><td className="px-4">{name(procedures, r.procedureId, (p) => p.name ?? '')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={!!newRule} title="Nueva regla de honorarios" onClose={() => setNewRule(null)}>
        {newRule && (
          <form onSubmit={createRule} className="space-y-3">
            <div><label className="label">Nombre *</label><input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Tipo</label><select value={newRule.type} onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}>{Object.entries(RULE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label">{newRule.type === 'FIXED_AMOUNT' ? 'Monto ($)' : 'Porcentaje (%)'}</label><input type="number" min={0} step="0.01" value={newRule.value} onChange={(e) => setNewRule({ ...newRule, value: e.target.value })} required /></div>
              <div><label className="label">Odontólogo</label><select value={newRule.dentistId} onChange={(e) => setNewRule({ ...newRule, dentistId: e.target.value })}><option value="">Todos</option>{dentists.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}</select></div>
              <div><label className="label">Procedimiento</label><select value={newRule.procedureId} onChange={(e) => setNewRule({ ...newRule, procedureId: e.target.value })}><option value="">Todos</option>{procedures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setNewRule(null)}>Cancelar</button><button className="btn-primary">Crear</button></div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

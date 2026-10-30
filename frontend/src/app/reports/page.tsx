'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { BarRow, ErrorBox, PageHeader, Spinner, StatStrip } from '@/components/ui';
import { api } from '@/lib/api';
import { APPT_STATUS, PAYMENT_METHODS, addDays, dateKey, money, pct } from '@/lib/format';

const PRESETS: [string, () => [string, string]][] = [
  ['Este mes', () => [dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), dateKey()]],
  ['Últimos 30 días', () => [dateKey(addDays(new Date(), -29)), dateKey()]],
  ['Últimos 90 días', () => [dateKey(addDays(new Date(), -89)), dateKey()]],
];

export default function ReportsPage() {
  const [from, setFrom] = useState(PRESETS[1][1]()[0]);
  const [to, setTo] = useState(dateKey());
  const [r, setR] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setR(null);
    api(`/reports/summary?from=${from}&to=${to}`).then(setR).catch((e) => setError(e.message));
  }, [from, to]);

  const maxDay = r ? Math.max(1, ...r.revenueByDay.map((d: any) => d.revenue)) : 1;

  return (
    <AppShell roles={['ACCOUNTANT']}>
      <PageHeader title="Reportes" subtitle="Ingresos, producción por profesional, ausentismo y consumo de insumos del período." />
      <ErrorBox error={error} />
      <div className="mb-6 flex flex-wrap items-end gap-2">
        <div><label className="label">Desde</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">Hasta</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {PRESETS.map(([l, f]) => <button key={l} className="btn-secondary" onClick={() => { const [a, b] = f(); setFrom(a); setTo(b); }}>{l}</button>)}
      </div>
      {!r ? <Spinner /> : (
        <div className="space-y-6">
          <StatStrip
            items={[
              { label: 'Ingresos cobrados', value: money(r.revenue), hint: `Facturado ${money(r.billed)} en ${r.invoices} facturas` },
              { label: 'Ticket promedio', value: money(r.averageTicket), hint: 'Por factura emitida' },
              { label: 'Ausentismo', value: pct(r.appointments.noShowRate), hint: `${r.appointments.total} citas en el período`, tone: r.appointments.noShowRate > 15 ? 'alert' : 'default' },
              { label: 'Presupuestos aceptados', value: pct(r.plans.conversionRate), hint: `${r.plans.accepted} de ${r.plans.created} · ${money(r.plans.acceptedAmount)}` },
            ]}
          />

          <section className="card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-semibold">Ingresos por día</h3>
              <span className="text-[12.5px] text-ink-muted">Máximo diario {money(maxDay)}</span>
            </div>
            <div className="relative flex h-48 items-end gap-[3px] overflow-x-auto border-b border-line">
              <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
              <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
              {r.revenueByDay.map((d: any) => (
                <div key={d.date} className="group relative flex h-full min-w-[8px] flex-1 flex-col justify-end">
                  <div className="rounded-t bg-brand-500 transition-colors group-hover:bg-brand-700" style={{ height: `${(d.revenue / maxDay) * 100}%`, minHeight: d.revenue ? 2 : 0 }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">{d.date}: {money(d.revenue)}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{r.period.from}</span><span>{r.period.to}</span></div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5 space-y-2">
              <h3 className="mb-2 font-semibold">Producción por odontólogo</h3>
              <p className="-mt-1 mb-2 text-[12.5px] text-ink-muted">Valor de los procedimientos atendidos · número de atenciones</p>
              {r.byDentist.map((d: any) => <BarRow key={d.name} label={d.name} value={d.production} max={r.byDentist[0]?.production || 1} display={`${money(d.production)} · ${d.completed} at.`} />)}
            </section>
            <section className="card p-5 space-y-2">
              <h3 className="mb-2 font-semibold">Conceptos más facturados</h3>
              {r.topConcepts.map((c: any) => <BarRow key={c.name} label={c.name} value={c.amount} max={r.topConcepts[0]?.amount || 1} display={money(c.amount)} />)}
            </section>
            <section className="card p-5 space-y-2">
              <h3 className="mb-2 font-semibold">Cobros por medio de pago</h3>
              {Object.entries(r.revenueByMethod).map(([k, v]: any) => <BarRow key={k} label={PAYMENT_METHODS[k] || k} value={v} max={Math.max(...(Object.values(r.revenueByMethod) as number[]))} display={money(v)} />)}
            </section>
            <section className="card p-5 space-y-2">
              <h3 className="mb-2 font-semibold">Citas por estado</h3>
              {Object.entries(r.appointments.byStatus).map(([k, v]: any) => <BarRow key={k} label={APPT_STATUS[k]?.label || k} value={v} max={r.appointments.total} />)}
            </section>
            <section className="card p-5 space-y-2">
              <h3 className="mb-2 font-semibold">Atenciones por especialidad</h3>
              {r.byCategory.map((c: any) => <BarRow key={c.category} label={c.category} value={c.count} max={r.byCategory[0]?.count || 1} />)}
            </section>
            <section className="card p-5 space-y-2">
              <h3 className="mb-2 font-semibold">Costo de insumos consumidos · {money(r.materials.cost)}</h3>
              {r.materials.top.map((m: any) => <BarRow key={m.name} label={m.name} value={m.cost} max={r.materials.top[0]?.cost || 1} display={money(m.cost)} />)}
              <p className="pt-2 text-xs text-slate-400">Pacientes nuevos en el período: {r.newPatients}</p>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

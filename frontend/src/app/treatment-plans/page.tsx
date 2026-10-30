'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import PatientPicker from '@/components/PatientPicker';
import { Badge, Empty, ErrorBox, Modal, Notice, PageHeader, Spinner } from '@/components/ui';
import { api, getUser, hasRole } from '@/lib/api';
import { APPT_STATUS, ITEM_STATUS, PLAN_STATUS, fmtDate, fmtDateTime, fullName, money, toLocalInput, plural } from '@/lib/format';
import { escapeHtml, openPrint } from '@/lib/print';

type Row = { procedureId: string; toothNumber: string; quantity: number; phase: number; discount: number; unitPrice: number; labCost: number };

function PlansInner() {
  const params = useSearchParams();
  const [plans, setPlans] = useState<any[] | null>(null);
  const [status, setStatus] = useState('');
  const [procedures, setProcedures] = useState<any[]>([]);
  const [builder, setBuilder] = useState<any>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/treatment-plans${status ? `?status=${status}` : ''}`).then(setPlans).catch((e) => setError(e.message)), [status]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api('/procedures').then(setProcedures).catch(() => {});
    const pid = params.get('patientId');
    if (params.get('new') && hasRole('DENTIST')) {
      if (pid) api(`/patients/${pid}`).then((p) => setBuilder({ patient: p })).catch(() => setBuilder({ patient: null }));
      else setBuilder({ patient: null });
    }
    if (params.get('open')) setOpenId(params.get('open'));
  }, [params]);

  return (
    <AppShell>
      <PageHeader
        title="Presupuestos y planes de tratamiento"
        subtitle="Presupuestos por fases, aprobación del paciente y agendamiento de los tratamientos aprobados."
        actions={hasRole('DENTIST') && <button className="btn-primary" onClick={() => setBuilder({ patient: null })}><Icon name="plus" size={18} /> Nuevo presupuesto</button>}
      />
      <ErrorBox error={error} onClose={() => setError('')} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['', 'Todos'], ...Object.entries(PLAN_STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={`chip ${status === k ? 'chip-active' : ''}`}>{l}</button>
        ))}
      </div>
      {!plans ? <Spinner /> : plans.length === 0 ? <Empty>No hay presupuestos</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-4 py-3 text-left">Presupuesto</th><th className="px-4 py-3 text-left">Paciente</th><th className="px-4 py-3 text-left hidden md:table-cell">Fecha</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => setOpenId(p.id)}>
                  <td className="px-4 py-3"><div className="font-semibold">{p.title}</div><div className="text-xs text-slate-500">{plural(p.items.length, 'ítem')} · {plural(p.totals.phases.length, 'fase')}{p.totals.doneTotal > 0 ? ` · realizado ${money(p.totals.doneTotal)}` : ''}</div></td>
                  <td className="px-4 py-3">{fullName(p.patient)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-3"><Badge cls={PLAN_STATUS[p.status]?.cls}>{PLAN_STATUS[p.status]?.label}</Badge></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(p.totals.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {builder && <PlanBuilder initialPatient={builder.patient} procedures={procedures} onClose={() => setBuilder(null)} onSaved={(p) => { setBuilder(null); load(); setOpenId(p.id); }} />}
      {openId && <PlanDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </AppShell>
  );
}

export default function TreatmentPlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansInner />
    </Suspense>
  );
}

function PlanBuilder({ initialPatient, procedures, onClose, onSaved }: { initialPatient: any; procedures: any[]; onClose: () => void; onSaved: (p: any) => void }) {
  const [patient, setPatient] = useState<any>(initialPatient);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const blank: Row = { procedureId: '', toothNumber: '', quantity: 1, phase: 1, discount: 0, unitPrice: 0, labCost: 0 };
  const [rows, setRows] = useState<Row[]>([{ ...blank }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isAdmin = hasRole();

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const pickProc = (i: number, id: string) => {
    const p = procedures.find((x) => x.id === id);
    setRow(i, { procedureId: id, unitPrice: Number(p?.price ?? 0), labCost: Number(p?.labCost ?? 0) });
  };
  const totals = useMemo(() => {
    const valid = rows.filter((r) => r.procedureId);
    const gross = valid.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
    const itemDisc = valid.reduce((s, r) => s + Number(r.discount || 0), 0);
    const lab = valid.reduce((s, r) => s + r.labCost * r.quantity, 0);
    const phases = new Map<number, number>();
    valid.forEach((r) => phases.set(r.phase, (phases.get(r.phase) || 0) + r.unitPrice * r.quantity - Number(r.discount || 0)));
    const total = Math.max(0, gross - itemDisc - Number(discount || 0));
    return { gross, lab, total, pct: gross ? ((itemDisc + Number(discount || 0)) / gross) * 100 : 0, phases: [...phases.entries()].sort((a, b) => a[0] - b[0]) };
  }, [rows, discount]);

  async function save(status: 'DRAFT' | 'PENDING_APPROVAL') {
    if (!patient) return setError('Seleccione un paciente');
    setSaving(true);
    setError('');
    try {
      const p = await api('/treatment-plans', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          title: title || undefined,
          notes: notes || undefined,
          discount: Number(discount) || 0,
          status,
          items: rows.filter((r) => r.procedureId).map((r) => ({ procedureId: r.procedureId, toothNumber: r.toothNumber ? Number(r.toothNumber) : undefined, quantity: Number(r.quantity), phase: Number(r.phase), discount: Number(r.discount) || 0, unitPrice: Number(r.unitPrice), labCost: Number(r.labCost) })),
        }),
      });
      onSaved(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Nuevo presupuesto" onClose={onClose} width="max-w-5xl">
      <ErrorBox error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Paciente *</label><PatientPicker value={patient} onChange={setPatient} /></div>
        <div><label className="label">Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Rehabilitación sector posterior" /></div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Procedimiento</th><th>Pieza</th><th>Cant.</th><th>Fase</th><th>Precio</th><th>Lab./u</th><th>Desc. $</th><th className="text-right">Subtotal</th><th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2 min-w-[220px]"><select value={r.procedureId} onChange={(e) => pickProc(i, e.target.value)}><option value="">Seleccionar…</option>{procedures.map((p) => <option key={p.id} value={p.id}>{p.category} · {p.name}</option>)}</select></td>
                <td className="pr-2"><input className="!w-16" placeholder="FDI" value={r.toothNumber} onChange={(e) => setRow(i, { toothNumber: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></td>
                <td className="pr-2"><input type="number" min={1} className="!w-16" value={r.quantity} onChange={(e) => setRow(i, { quantity: Math.max(1, Number(e.target.value)) })} /></td>
                <td className="pr-2"><input type="number" min={1} className="!w-14" value={r.phase} onChange={(e) => setRow(i, { phase: Math.max(1, Number(e.target.value)) })} /></td>
                <td className="pr-2"><input type="number" min={0} step="0.01" className="!w-24" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: Number(e.target.value) })} /></td>
                <td className="pr-2"><input type="number" min={0} step="0.01" className="!w-20" value={r.labCost} onChange={(e) => setRow(i, { labCost: Number(e.target.value) })} /></td>
                <td className="pr-2"><input type="number" min={0} step="0.01" className="!w-20" value={r.discount} onChange={(e) => setRow(i, { discount: Number(e.target.value) })} /></td>
                <td className="text-right font-semibold tabular-nums">{money(r.unitPrice * r.quantity - Number(r.discount || 0))}</td>
                <td className="pl-2"><button type="button" className="text-slate-400 hover:text-red-600" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Quitar"><Icon name="close" size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="mt-2 text-sm font-semibold text-brand-700" onClick={() => setRows([...rows, { ...blank, phase: rows[rows.length - 1]?.phase || 1 }])}>+ Agregar procedimiento</button>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div><label className="label">Descuento general ($)</label><input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
          <div><label className="label">Observaciones</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          {totals.pct > 10 && !isAdmin && <Notice tone="warn">Descuento total de {totals.pct.toFixed(1)}%: supera el 10% permitido sin autorización; un administrador debe registrarlo.</Notice>}
        </div>
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          {totals.phases.map(([ph, v]) => <div key={ph} className="flex justify-between"><span className="text-slate-500">Fase {ph}</span><span className="tabular-nums">{money(v)}</span></div>)}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">Costo de laboratorio (incluido)</span><span className="tabular-nums">{money(totals.lab)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Descuento total</span><span className="tabular-nums">{totals.pct.toFixed(1)}%</span></div>
          <div className="mt-2 flex justify-between text-lg font-semibold"><span>Total</span><span className="tabular-nums">{money(totals.total)}</span></div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-secondary" disabled={saving} onClick={() => save('DRAFT')}>Guardar borrador</button>
        <button className="btn-primary" disabled={saving} onClick={() => save('PENDING_APPROVAL')}>Enviar a aprobación del paciente</button>
      </div>
    </Modal>
  );
}

function PlanDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [plan, setPlan] = useState<any>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [schedule, setSchedule] = useState<any>(null);
  const [dentists, setDentists] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const canApprove = hasRole('DENTIST', 'ASSISTANT', 'RECEPTIONIST');

  const load = useCallback(async () => {
    try {
      const p = await api(`/treatment-plans/${id}`);
      setPlan(p);
      setPicked(new Set(p.items.filter((i: any) => i.status !== 'DONE' && !i.approved).map((i: any) => i.id)));
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);
  useEffect(() => {
    load();
    Promise.all([api('/users/dentists'), api('/rooms')]).then(([d, r]) => { setDentists(d); setRooms(r); }).catch(() => {});
  }, [load]);

  async function run(fn: () => Promise<any>, msg?: string) {
    setError('');
    setInfo('');
    try {
      const r = await fn();
      if (msg || r?.message) setInfo(r?.message || msg);
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!plan) return <Modal open title="Presupuesto" onClose={onClose}><ErrorBox error={error} /><Spinner /></Modal>;

  const t = plan.totals;
  const phases = [...new Set(plan.items.map((i: any) => i.phase ?? 1))].sort((a: any, b: any) => a - b) as number[];
  const toSchedule = plan.items.filter((i: any) => i.approved && i.status !== 'DONE' && !plan.appointments.some((a: any) => a.treatmentPlanItemId === i.id && !['CANCELLED', 'NO_SHOW'].includes(a.status)));

  function print() {
    openPrint(`Presupuesto ${plan.title}`, `
      <div class="head"><div><h1>Presupuesto de tratamiento</h1><div class="muted">${escapeHtml(getUser()?.clinicName)}</div></div><div class="muted">${fmtDate(plan.createdAt)}</div></div>
      <p><strong>Paciente:</strong> ${escapeHtml(fullName(plan.patient))} · ${escapeHtml(plan.patient.documentNumber)}</p>
      <p><strong>${escapeHtml(plan.title)}</strong></p>
      ${phases.map((ph) => `<h2>Fase ${ph}</h2><table><thead><tr><th>Procedimiento</th><th>Pieza</th><th>Cant.</th><th>Precio</th><th>Desc.</th><th>Subtotal</th></tr></thead><tbody>${plan.items.filter((i: any) => (i.phase ?? 1) === ph).map((i: any) => `<tr><td>${escapeHtml(i.procedure.name)}</td><td>${i.toothNumber ?? ''}</td><td>${i.quantity}</td><td>${money(i.unitPrice)}</td><td>${money(i.discount)}</td><td>${money(Number(i.unitPrice) * i.quantity - Number(i.discount))}</td></tr>`).join('')}</tbody></table>`).join('')}
      <h2>Total: ${money(t.total)}</h2><p class="muted">Descuento general: ${money(t.planDiscount)} · Incluye costos de laboratorio por ${money(t.labCost)}. Validez: 30 días.</p>
      <div class="sign"><div>Firma del paciente (aceptación)</div><div>Profesional</div></div>`);
  }

  return (
    <Modal open title={plan.title} onClose={onClose} width="max-w-5xl">
      <ErrorBox error={error} />
      {info && <Notice tone="success">{info}</Notice>}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Badge cls={PLAN_STATUS[plan.status]?.cls}>{PLAN_STATUS[plan.status]?.label}</Badge>
        <Link href={`/patients/${plan.patient.id}`} className="font-semibold hover:text-brand-700">{fullName(plan.patient)}</Link>
        <span className="text-slate-500">Creado {fmtDate(plan.createdAt)}{plan.approvedAt ? ` · aprobado ${fmtDate(plan.approvedAt)}` : ''}</span>
        <button className="btn-secondary !py-1 text-xs ml-auto" onClick={print}><Icon name="print" size={14} /> Imprimir</button>
      </div>

      {phases.map((ph) => (
        <div key={ph} className="mb-4">
          <div className="mb-1 flex items-center justify-between text-sm font-semibold">
            <span>Fase {ph}</span>
            <span className="tabular-nums text-slate-600">{money(t.phases.find((p: any) => p.phase === ph)?.subtotal)}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <tbody>
                {plan.items.filter((i: any) => (i.phase ?? 1) === ph).map((i: any) => {
                  const appt = plan.appointments.find((a: any) => a.treatmentPlanItemId === i.id && a.status !== 'CANCELLED');
                  return (
                    <tr key={i.id} className="border-b border-slate-50 last:border-0">
                      <td className="w-8 px-3 py-2">
                        {i.status !== 'DONE' && !i.approved && canApprove && !['COMPLETED', 'CANCELLED'].includes(plan.status) && (
                          <input type="checkbox" className="h-4 w-4" checked={picked.has(i.id)} onChange={(e) => { const s = new Set(picked); e.target.checked ? s.add(i.id) : s.delete(i.id); setPicked(s); }} />
                        )}
                        {i.approved && i.status !== 'DONE' && <Icon name="check" size={16} className="text-emerald-600" />}
                      </td>
                      <td className="py-2"><div className="font-medium">{i.procedure.name}{i.toothNumber ? ` · pieza ${i.toothNumber}` : ''}</div><div className="text-xs text-slate-500">{i.quantity} × {money(i.unitPrice)}{Number(i.discount) ? ` − ${money(i.discount)}` : ''}{Number(i.labCost) ? ` · lab. ${money(Number(i.labCost) * i.quantity)}` : ''}</div></td>
                      <td className="px-2 py-2 text-xs text-slate-500">{appt ? `Cita ${fmtDateTime(appt.startAt)} · ${APPT_STATUS[appt.status]?.label}` : ''}</td>
                      <td className="px-2 py-2"><Badge cls={ITEM_STATUS[i.status]?.cls}>{ITEM_STATUS[i.status]?.label}</Badge></td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(Number(i.unitPrice) * i.quantity - Number(i.discount))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          {canApprove && plan.status === 'DRAFT' && <button className="btn-secondary w-full" onClick={() => run(() => api(`/treatment-plans/${id}/status/PENDING_APPROVAL`, { method: 'PATCH' }), 'Enviado a aprobación')}>Marcar como enviado al paciente</button>}
          {canApprove && picked.size > 0 && !['COMPLETED', 'CANCELLED'].includes(plan.status) && (
            <button className="btn-primary w-full" onClick={() => run(() => api(`/treatment-plans/${id}/approve`, { method: 'POST', body: JSON.stringify({ itemIds: [...picked] }) }), `Aprobados ${picked.size} ítem(s)`)}>
              Registrar aprobación del paciente ({picked.size} de {plan.items.filter((i: any) => i.status !== 'DONE' && !i.approved).length} ítems)
            </button>
          )}
          {canApprove && toSchedule.length > 0 && (
            <button className="btn-primary w-full" onClick={() => setSchedule({ dentistId: dentists[0]?.id || '', roomId: '', start: toLocalInput(new Date(Date.now() + 86400000)), groupByPhase: false })}>
              <Icon name="calendar" size={16} /> Agendar {plural(toSchedule.length, 'ítem aprobado', 'ítems aprobados')}
            </button>
          )}
          {canApprove && !['COMPLETED', 'CANCELLED'].includes(plan.status) && (
            <button className="w-full text-sm font-semibold text-red-600 hover:underline" onClick={() => confirm('¿Cancelar este presupuesto?') && run(() => api(`/treatment-plans/${id}/status/CANCELLED`, { method: 'PATCH' }))}>Cancelar presupuesto</button>
          )}
        </div>
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Bruto</span><span className="tabular-nums">{money(t.gross)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Descuentos</span><span className="tabular-nums">−{money(t.itemDiscounts + t.planDiscount)} ({t.discountPct}%)</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Laboratorio</span><span className="tabular-nums">{money(t.labCost)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Aprobado</span><span className="tabular-nums">{money(t.approvedTotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Realizado</span><span className="tabular-nums">{money(t.doneTotal)}</span></div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold"><span>Total</span><span className="tabular-nums">{money(t.total)}</span></div>
        </div>
      </div>

      {schedule && (
        <form
          onSubmit={(e) => { e.preventDefault(); run(() => api(`/treatment-plans/${id}/approve-and-schedule`, { method: 'POST', body: JSON.stringify({ dentistId: schedule.dentistId, roomId: schedule.roomId || undefined, startAt: new Date(schedule.start).toISOString(), groupByPhase: schedule.groupByPhase, itemIds: toSchedule.map((i: any) => i.id) }) })).then(() => setSchedule(null)); }}
          className="mt-4 grid gap-3 rounded-lg border border-brand-200 bg-brand-50/40 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 text-sm font-semibold">Convertir en citas</div>
          <div><label className="label">Odontólogo</label><select value={schedule.dentistId} onChange={(e) => setSchedule({ ...schedule, dentistId: e.target.value })} required>{dentists.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}</select></div>
          <div><label className="label">Sillón</label><select value={schedule.roomId} onChange={(e) => setSchedule({ ...schedule, roomId: e.target.value })}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div><label className="label">Inicio de la primera cita</label><input type="datetime-local" value={schedule.start} onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} required /></div>
          <label className="mt-6 inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={schedule.groupByPhase} onChange={(e) => setSchedule({ ...schedule, groupByPhase: e.target.checked })} /> Una cita por fase</label>
          <p className="sm:col-span-2 text-xs text-slate-500">Las citas se crean consecutivas usando la duración de cada procedimiento. Si un sillón u odontólogo está ocupado, no se crea ninguna.</p>
          <div className="sm:col-span-2 flex gap-2"><button className="btn-primary">Crear citas</button><button type="button" className="btn-secondary" onClick={() => setSchedule(null)}>Cancelar</button></div>
        </form>
      )}
    </Modal>
  );
}

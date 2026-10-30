'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import PatientPicker from '@/components/PatientPicker';
import { Badge, Empty, ErrorBox, Modal, Notice, PageHeader, Spinner, StatStrip, Tabs } from '@/components/ui';
import { api, download, hasRole } from '@/lib/api';
import { INVOICE_STATUS, PAYMENT_METHODS, dateKey, fmtDate, fmtDateTime, fmtTime, fullName, money } from '@/lib/format';

type Tab = 'invoices' | 'close' | 'day';
const CLOSE_LABELS: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencias / seguros' };

function CajaInner() {
  const params = useSearchParams();
  const finance = hasRole('ACCOUNTANT');
  const [tab, setTab] = useState<Tab>('invoices');
  return (
    <AppShell roles={['RECEPTIONIST', 'ACCOUNTANT']}>
      <PageHeader title="Caja y facturación" subtitle="Facturas electrónicas, cobros con varias formas de pago y cierre de caja diario." />
      <Tabs
        tabs={[
          { id: 'invoices' as Tab, label: 'Facturas' },
          { id: 'close' as Tab, label: 'Cierre de caja' },
          ...(finance ? [{ id: 'day' as Tab, label: 'Movimientos del día' }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'invoices' && <InvoicesTab patientId={params.get('patientId') || ''} />}
      {tab === 'close' && <CloseTab finance={finance} />}
      {tab === 'day' && <DayTab />}
    </AppShell>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={null}>
      <CajaInner />
    </Suspense>
  );
}

function InvoicesTab({ patientId }: { patientId: string }) {
  const [list, setList] = useState<any[] | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (patientId) qs.set('patientId', patientId);
    return api(`/invoices?${qs}`).then(setList).catch((e) => setError(e.message));
  }, [status, patientId]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<any>) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <>
      <ErrorBox error={error} onClose={() => setError('')} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[['', 'Todas'], ['ISSUED,PARTIALLY_PAID', 'Por cobrar'], ['PAID', 'Pagadas'], ['DRAFT', 'Borradores'], ['CANCELLED', 'Anuladas']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={`chip ${status === k ? 'chip-active' : ''}`}>{l}</button>
        ))}
        <button className="btn-primary ml-auto" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> Nueva factura</button>
      </div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty>Sin facturas</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-4 py-3 text-left">Número</th><th className="px-4 py-3 text-left">Paciente</th><th className="px-4 py-3 text-left hidden md:table-cell">Fecha</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {list.map((inv) => {
                const balance = Number(inv.total) - Number(inv.paidAmount);
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-medium tabular-nums"><button className="hover:text-brand-700" onClick={() => setDetail(inv)}>{inv.number || 'Borrador'}</button></td>
                    <td className="px-4 py-3">{fullName(inv.patient)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{fmtDate(inv.issuedAt || inv.createdAt)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(inv.total)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${balance > 0 && inv.status !== 'CANCELLED' ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{inv.status === 'CANCELLED' ? '—' : money(balance)}</td>
                    <td className="px-4 py-3"><Badge cls={INVOICE_STATUS[inv.status]?.cls}>{INVOICE_STATUS[inv.status]?.label}</Badge></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      {inv.status === 'DRAFT' && <button className="text-xs font-semibold text-brand-700" onClick={() => act(() => api(`/invoices/${inv.id}/issue`, { method: 'PATCH' }))}>Emitir</button>}
                      {['ISSUED', 'PARTIALLY_PAID'].includes(inv.status) && <button className="text-xs font-semibold text-emerald-700" onClick={() => setPaying(inv)}>Cobrar</button>}
                      {inv.sriAccessKey && <button className="text-xs font-semibold text-slate-600" onClick={() => act(() => download(`/invoices/${inv.id}/sri-xml`, `factura-${inv.number}.xml`))} title="XML del comprobante SRI">XML</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateInvoice onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
      {paying && <PayInvoice invoice={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); load(); }} />}
      {detail && <InvoiceDetail invoice={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); load(); }} />}
    </>
  );
}

function CreateInvoice({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [patient, setPatient] = useState<any>(null);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [issue, setIssue] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/procedures').then(setProcedures).catch(() => {});
  }, []);
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const setItem = (i: number, patch: any) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) return setError('Seleccione un paciente');
    try {
      await api('/invoices', { method: 'POST', body: JSON.stringify({ patientId: patient.id, items: items.filter((i) => i.description), issue }) });
      onDone();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Modal open title="Nueva factura" onClose={onClose} width="max-w-3xl">
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox error={error} />
        <div><label className="label">Paciente *</label><PatientPicker value={patient} onChange={setPatient} /></div>
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_5rem_7rem_auto]">
            <input placeholder="Descripción *" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} required={i === 0} />
            <select value="" onChange={(e) => { const p = procedures.find((x) => x.id === e.target.value); if (p) setItem(i, { description: p.name, unitPrice: Number(p.price) }); }}>
              <option value="">Del catálogo…</option>
              {procedures.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
            </select>
            <input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Math.max(1, Number(e.target.value)) })} />
            <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} />
            <button type="button" className="btn-secondary !px-2" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Quitar"><Icon name="close" size={16} /></button>
          </div>
        ))}
        <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])}>+ Agregar ítem</button>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={issue} onChange={(e) => setIssue(e.target.checked)} /> Emitir ahora (número SRI y clave de acceso)</label>
          <div className="text-right"><div className="text-xs text-slate-500">Total (servicios de salud IVA 0%)</div><div className="text-xl font-semibold tabular-nums">{money(total)}</div></div>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary">Crear factura</button></div>
      </form>
    </Modal>
  );
}

function PayInvoice({ invoice, onClose, onDone }: { invoice: any; onClose: () => void; onDone: () => void }) {
  const balance = Math.round((Number(invoice.total) - Number(invoice.paidAmount)) * 100) / 100;
  const [lines, setLines] = useState([{ method: 'CASH', amount: balance, reference: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sum = Math.round(lines.reduce((s, l) => s + Number(l.amount || 0), 0) * 100) / 100;
  const setLine = (i: number, patch: any) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sum > balance + 0.001) return setError(`La suma (${money(sum)}) supera el saldo (${money(balance)})`);
    setBusy(true);
    setError('');
    try {
      for (const l of lines.filter((x) => Number(x.amount) > 0)) {
        await api(`/invoices/${invoice.id}/payments`, { method: 'POST', body: JSON.stringify({ amount: Number(l.amount), method: l.method, reference: l.reference || undefined }) });
      }
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Cobrar ${invoice.number}`} onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox error={error} />
        <div className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{fullName(invoice.patient)}</span><span>Saldo: <strong className="tabular-nums">{money(balance)}</strong></span></div>
        <p className="text-xs text-slate-500">Pago mixto: agregue una línea por cada forma de pago.</p>
        {lines.map((l, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
            <select value={l.method} onChange={(e) => setLine(i, { method: e.target.value })}>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input type="number" min={0.01} step="0.01" value={l.amount} onChange={(e) => setLine(i, { amount: Number(e.target.value) })} />
            <input placeholder={l.method === 'CASH' ? 'Referencia (opcional)' : 'Voucher / transferencia / póliza *'} value={l.reference} onChange={(e) => setLine(i, { reference: e.target.value })} required={l.method !== 'CASH' && l.method !== 'OTHER'} />
            <button type="button" className="btn-secondary !px-2" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Quitar"><Icon name="close" size={16} /></button>
          </div>
        ))}
        <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setLines([...lines, { method: 'CARD', amount: Math.max(0, Math.round((balance - sum) * 100) / 100), reference: '' }])}>+ Otra forma de pago</button>
        <div className="flex items-center justify-between text-sm"><span>Total a registrar: <strong className="tabular-nums">{money(sum)}</strong></span>{sum < balance && <span className="text-amber-700">Quedará un saldo de {money(balance - sum)}</span>}</div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || sum <= 0}>Registrar pago</button></div>
      </form>
    </Modal>
  );
}

function InvoiceDetail({ invoice, onClose, onChanged }: { invoice: any; onClose: () => void; onChanged: () => void }) {
  const [error, setError] = useState('');
  const canCancel = hasRole('ACCOUNTANT') && invoice.status !== 'CANCELLED' && !invoice.payments?.length;
  return (
    <Modal open title={`Factura ${invoice.number || '(borrador)'}`} onClose={onClose} width="max-w-2xl">
      <ErrorBox error={error} />
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{fullName(invoice.patient)} · {invoice.patient?.documentNumber}</span><Badge cls={INVOICE_STATUS[invoice.status]?.cls}>{INVOICE_STATUS[invoice.status]?.label}</Badge></div>
        {invoice.sriAccessKey && <div className="rounded-lg bg-slate-50 p-2 font-mono text-[11px] break-all">Clave de acceso SRI: {invoice.sriAccessKey} <span className="ml-1 font-sans text-slate-500">({invoice.sriStatus})</span></div>}
        <table className="w-full"><tbody>{invoice.items.map((it: any) => <tr key={it.id} className="border-b border-slate-50"><td className="py-1.5">{it.description}</td><td className="text-right">{it.quantity} × {money(it.unitPrice)}</td><td className="text-right font-semibold tabular-nums">{money(it.total)}</td></tr>)}</tbody></table>
        <div className="text-right text-lg font-semibold">{money(invoice.total)}</div>
        {invoice.payments?.length > 0 && (
          <div><div className="label">Pagos</div>{invoice.payments.map((p: any) => <div key={p.id} className="flex justify-between"><span>{fmtDateTime(p.paidAt)} · {PAYMENT_METHODS[p.method]}{p.reference ? ` · ${p.reference}` : ''}</span><span className="tabular-nums">{money(p.amount)}</span></div>)}</div>
        )}
        {invoice.notes && <p className="text-slate-500 whitespace-pre-line">{invoice.notes}</p>}
        {canCancel && (
          <button className="text-sm font-semibold text-red-600" onClick={async () => { const reason = prompt('Motivo de la anulación'); if (!reason) return; try { await api(`/invoices/${invoice.id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }); onChanged(); } catch (e: any) { setError(e.message); } }}>Anular factura</button>
        )}
      </div>
    </Modal>
  );
}

/** RN-02: la recepcionista ingresa el conteo sin ver el total teórico; recién al guardar se revela la diferencia. */
function CloseTab({ finance }: { finance: boolean }) {
  const [date, setDate] = useState(dateKey());
  const [status, setStatus] = useState<any>(null);
  const [form, setForm] = useState({ physicalCash: '', physicalCard: '', physicalTransfer: '', notes: '' });
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/invoices/reports/blind-close/status?date=${date}`).then(setStatus).catch((e) => setError(e.message));
    if (finance) api('/invoices/reports/cash-closes').then(setHistory).catch(() => setHistory([]));
  }, [date, finance]);
  useEffect(() => {
    setResult(null);
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm('Una vez registrado el conteo no podrá modificarse. ¿Continuar?')) return;
    setError('');
    try {
      const r = await api('/invoices/reports/blind-close', { method: 'POST', body: JSON.stringify({ date, physicalCash: Number(form.physicalCash || 0), physicalCard: Number(form.physicalCard || 0), physicalTransfer: Number(form.physicalTransfer || 0), notes: form.notes || undefined }) });
      setResult(r);
      setForm({ physicalCash: '', physicalCard: '', physicalTransfer: '', notes: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const diffCls = (v: number) => (v === 0 ? 'text-emerald-700' : v > 0 ? 'text-sky-700' : 'text-red-700');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Cierre de caja ciego</h3>
          {finance && <input type="date" className="!w-auto" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} />}
        </div>
        <ErrorBox error={error} onClose={() => setError('')} />
        {result ? (
          <div className="space-y-3">
            <Notice tone={result.summary.difference.cash === 0 ? 'success' : 'warn'}><strong>{result.message}</strong></Notice>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Medio</th><th className="text-right">Contado</th><th className="text-right">Sistema</th><th className="text-right">Diferencia</th></tr></thead>
              <tbody>
                {(['cash', 'card', 'transfer'] as const).map((k) => (
                  <tr key={k} className="border-t border-slate-100"><td className="py-1.5">{CLOSE_LABELS[k]}</td><td className="text-right tabular-nums">{money(result.summary.physical[k])}</td><td className="text-right tabular-nums">{money(result.summary.theoretical[k])}</td><td className={`text-right font-semibold tabular-nums ${diffCls(result.summary.difference[k])}`}>{money(result.summary.difference[k])}</td></tr>
                ))}
                <tr className="border-t-2 border-slate-200 font-semibold"><td className="py-1.5">Total</td><td className="text-right tabular-nums">{money(result.summary.physical.total)}</td><td className="text-right tabular-nums">{money(result.summary.theoretical.total)}</td><td className={`text-right tabular-nums ${diffCls(result.summary.difference.total)}`}>{money(result.summary.difference.total)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : status?.closed ? (
          <Notice tone="success">La caja del {status.date} ya fue cerrada ({fmtDateTime(status.closedAt)}).</Notice>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Notice>Cuente el dinero y los comprobantes del día <strong>{date}</strong> e ingrese los montos. El total del sistema se mostrará solo después de registrar el conteo.</Notice>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label">Efectivo contado *</label><input type="number" min={0} step="0.01" value={form.physicalCash} onChange={(e) => setForm({ ...form, physicalCash: e.target.value })} required /></div>
              <div><label className="label">Vouchers tarjeta</label><input type="number" min={0} step="0.01" value={form.physicalCard} onChange={(e) => setForm({ ...form, physicalCard: e.target.value })} /></div>
              <div><label className="label">Transferencias / seguros</label><input type="number" min={0} step="0.01" value={form.physicalTransfer} onChange={(e) => setForm({ ...form, physicalTransfer: e.target.value })} /></div>
            </div>
            <input placeholder="Observaciones" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="btn-primary">Registrar conteo y cerrar caja</button>
          </form>
        )}
      </section>

      {finance && (
        <section className="card p-5">
          <h3 className="mb-3 font-semibold">Historial de cierres</h3>
          {!history ? <Spinner /> : history.length === 0 ? <p className="text-sm text-slate-400">Sin cierres.</p> : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Fecha</th><th className="text-right">Efectivo contado</th><th className="text-right">Diferencia</th><th className="pl-2">Responsable</th></tr></thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100"><td className="py-1.5">{fmtDate(c.closeDate)}</td><td className="text-right tabular-nums">{money(c.physicalCash)}</td><td className={`text-right font-semibold tabular-nums ${diffCls(Number(c.differenceCash))}`}>{money(c.differenceCash)}</td><td className="pl-2 text-xs text-slate-500">{c.closedBy || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function DayTab() {
  const [date, setDate] = useState(dateKey());
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    setD(null);
    api(`/invoices/reports/daily-close?date=${date}`).then(setD).catch(() => setD({ error: true }));
  }, [date]);
  return (
    <div className="space-y-4">
      <input type="date" className="!w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      {!d ? <Spinner /> : d.error ? <Empty>No disponible</Empty> : (
        <>
          <StatStrip
            items={[
              { label: 'Total cobrado', value: money(d.total), hint: `${d.count} pagos${d.closed ? ' · caja cerrada' : ''}` },
              ...Object.entries(d.byMethod).slice(0, 3).map(([k, v]) => ({ label: PAYMENT_METHODS[k] || k, value: money(v) })),
            ]}
          />
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className="px-4 py-3 text-left">Hora</th><th className="px-4 py-3 text-left">Factura</th><th className="px-4 py-3 text-left">Paciente</th><th className="px-4 py-3 text-left">Medio</th><th className="px-4 py-3 text-right">Monto</th></tr></thead>
              <tbody>{d.payments.map((p: any) => <tr key={p.id}><td className="px-4 py-2">{fmtTime(p.paidAt)}</td><td className="px-4 py-2 tabular-nums">{p.invoiceNumber}</td><td className="px-4 py-2">{p.patient}</td><td className="px-4 py-2">{PAYMENT_METHODS[p.method]}{p.reference ? ` · ${p.reference}` : ''}</td><td className="px-4 py-2 text-right tabular-nums">{money(p.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import { Badge, ErrorBox, Modal, PageHeader, Spinner, StatStrip, Tabs } from '@/components/ui';
import { api, hasRole } from '@/lib/api';
import { fmtDateTime, money } from '@/lib/format';

const MOV: Record<string, { label: string; cls: string }> = {
  IN: { label: 'Entrada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  OUT: { label: 'Salida', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  ADJUST: { label: 'Ajuste', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
};

export default function InventoryPage() {
  const [tab, setTab] = useState<'products' | 'movements' | 'recipes'>('products');
  const [val, setVal] = useState<any>(null);
  const [products, setProducts] = useState<any[] | null>(null);
  const [movements, setMovements] = useState<any[] | null>(null);
  const [recipes, setRecipes] = useState<any[] | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const [create, setCreate] = useState<any>(null);
  const [adjust, setAdjust] = useState<any>(null);
  const [error, setError] = useState('');
  const canCreate = hasRole('ACCOUNTANT', 'ASSISTANT');

  const load = useCallback(() => {
    api('/inventory/products').then(setProducts).catch((e) => setError(e.message));
    api('/inventory/valuation').then(setVal).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (tab === 'movements') api('/inventory/movements').then(setMovements).catch((e) => setError(e.message));
    if (tab === 'recipes') api('/inventory/recipes').then(setRecipes).catch((e) => setError(e.message));
  }, [tab]);

  const act = async (fn: () => Promise<any>) => {
    setError('');
    try {
      await fn();
      load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    }
  };
  const low = (p: any) => Number(p.stock) <= Number(p.minStock);
  const shown = (products || []).filter((p) => !onlyLow || low(p));

  return (
    <AppShell>
      <PageHeader title="Inventario de insumos" subtitle="El stock se descuenta automáticamente cuando una cita se marca como atendida." actions={canCreate && <button className="btn-primary" onClick={() => setCreate({ name: '', sku: '', unit: 'UND', stock: 0, minStock: 5, unitCost: 0 })}><Icon name="plus" size={18} /> Producto</button>} />
      <ErrorBox error={error} onClose={() => setError('')} />
      <div className="mb-6">
        <StatStrip
          items={[
            { label: 'Productos', value: products?.length ?? '…' },
            { label: 'Bajo el stock mínimo', value: products ? products.filter(low).length : '…', tone: products && products.some(low) ? 'alert' : 'default' },
            { label: 'Valor del inventario', value: val ? money(val.totalCost) : '…', hint: 'A costo unitario' },
          ]}
        />
      </div>
      <Tabs tabs={[{ id: 'products' as const, label: 'Productos' }, { id: 'movements' as const, label: 'Kardex' }, { id: 'recipes' as const, label: 'Recetas de consumo' }]} value={tab} onChange={setTab} />

      {tab === 'products' && (
        <>
          <label className="mb-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Solo bajo stock</label>
          {!products ? <Spinner /> : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><th className="px-4 py-3 text-left">Producto</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3 text-right">Mínimo</th><th className="px-4 py-3 text-right">Costo u.</th><th className="px-4 py-3 text-right">Valor</th><th /></tr></thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-400">{p.sku}</div></td>
                      <td className="px-4 text-right tabular-nums">{low(p) ? <Badge cls="bg-red-50 text-red-700 ring-red-600/20">{Number(p.stock)} {p.unit}</Badge> : `${Number(p.stock)} ${p.unit}`}</td>
                      <td className="px-4 text-right tabular-nums text-slate-500">{Number(p.minStock)}</td>
                      <td className="px-4 text-right tabular-nums">{money(p.unitCost)}</td>
                      <td className="px-4 text-right tabular-nums">{money(Number(p.stock) * Number(p.unitCost))}</td>
                      <td className="px-4 text-right">{canCreate && <button className="text-xs font-semibold text-brand-700" onClick={() => setAdjust({ product: p, type: 'IN', quantity: 1, reason: '' })}>Movimiento</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'movements' && (!movements ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Producto</th><th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-left">Motivo</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}><td className="px-4 py-2 text-xs text-slate-500">{fmtDateTime(m.createdAt)}</td><td className="px-4">{m.product?.name}</td><td className="px-4"><Badge cls={MOV[m.type]?.cls}>{MOV[m.type]?.label}</Badge></td><td className="px-4 text-right tabular-nums">{Number(m.quantity)} {m.product?.unit}</td><td className="px-4 text-slate-600">{m.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'recipes' && (!recipes ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {recipes.map((r) => (
            <div key={r.id} className="card p-4 text-sm">
              <div className="mb-2 font-semibold">{r.name}</div>
              <ul className="space-y-0.5 text-slate-600">{r.consumptions.map((c: any) => <li key={c.id}>{Number(c.quantity)} {c.product.unit} · {c.product.name}</li>)}</ul>
            </div>
          ))}
          <p className="text-xs text-slate-400 md:col-span-2">Para editar una receta vaya al Catálogo → Insumos.</p>
        </div>
      ))}

      <Modal open={!!create} title="Nuevo producto" onClose={() => setCreate(null)}>
        {create && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await act(() => api('/inventory/products', { method: 'POST', body: JSON.stringify({ ...create, stock: Number(create.stock), minStock: Number(create.minStock), unitCost: Number(create.unitCost) }) }))) setCreate(null); }} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Nombre *</label><input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} required /></div>
            <div><label className="label">SKU</label><input value={create.sku} onChange={(e) => setCreate({ ...create, sku: e.target.value })} /></div>
            <div><label className="label">Unidad</label><input value={create.unit} onChange={(e) => setCreate({ ...create, unit: e.target.value })} /></div>
            <div><label className="label">Stock inicial</label><input type="number" min={0} value={create.stock} onChange={(e) => setCreate({ ...create, stock: e.target.value })} /></div>
            <div><label className="label">Stock mínimo</label><input type="number" min={0} value={create.minStock} onChange={(e) => setCreate({ ...create, minStock: e.target.value })} /></div>
            <div><label className="label">Costo unitario</label><input type="number" min={0} step="0.01" value={create.unitCost} onChange={(e) => setCreate({ ...create, unitCost: e.target.value })} /></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary">Guardar</button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!adjust} title={`Movimiento · ${adjust?.product.name || ''}`} onClose={() => setAdjust(null)}>
        {adjust && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await act(() => api(`/inventory/products/${adjust.product.id}/stock`, { method: 'PATCH', body: JSON.stringify({ type: adjust.type, quantity: Number(adjust.quantity), reason: adjust.reason || undefined }) }))) setAdjust(null); }} className="space-y-3">
            <p className="text-sm text-slate-500">Stock actual: <strong>{Number(adjust.product.stock)} {adjust.product.unit}</strong></p>
            <select value={adjust.type} onChange={(e) => setAdjust({ ...adjust, type: e.target.value })}>
              <option value="IN">Entrada (compra)</option>
              <option value="OUT">Salida manual</option>
              <option value="ADJUST">Ajuste por conteo físico (fija el stock)</option>
            </select>
            <input type="number" min={0} step="0.01" value={adjust.quantity} onChange={(e) => setAdjust({ ...adjust, quantity: e.target.value })} required />
            <input placeholder="Motivo / n.º de factura de compra" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
            <div className="flex justify-end"><button className="btn-primary">Registrar</button></div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

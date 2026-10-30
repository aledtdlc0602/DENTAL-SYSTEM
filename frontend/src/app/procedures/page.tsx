'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import { ErrorBox, Modal, Notice, PageHeader, Spinner } from '@/components/ui';
import { api, hasRole } from '@/lib/api';
import { money } from '@/lib/format';

const CATEGORIES = ['General', 'Diagnóstico', 'Preventiva', 'Operatoria', 'Endodoncia', 'Periodoncia', 'Cirugía', 'Implantología', 'Prótesis', 'Ortodoncia', 'Estética'];

export default function ProceduresPage() {
  const admin = hasRole();
  const [list, setList] = useState<any[] | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [recipe, setRecipe] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => api('/procedures').then(setList).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    api('/inventory/products').then(setProducts).catch(() => {});
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const body = { name: edit.name, code: edit.code || undefined, category: edit.category, price: Number(edit.price), labCost: Number(edit.labCost || 0), durationMin: Number(edit.durationMin) };
      if (edit.id) await api(`/procedures/${edit.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/procedures', { method: 'POST', body: JSON.stringify(body) });
      setEdit(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function openRecipe(p: any) {
    const items = await api(`/inventory/procedures/${p.id}/recipe`).catch(() => []);
    setRecipe({ procedure: p, items: items.map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity) })) });
  }
  async function saveRecipe(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/inventory/procedures/${recipe.procedure.id}/recipe`, { method: 'POST', body: JSON.stringify({ items: recipe.items.filter((i: any) => i.productId && i.quantity > 0) }) });
      setMsg(`Receta de consumo de "${recipe.procedure.name}" guardada`);
      setRecipe(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const filtered = (list || []).filter((p) => !q || `${p.name} ${p.category} ${p.code}`.toLowerCase().includes(q.toLowerCase()));
  const groups = CATEGORIES.concat([...new Set(filtered.map((p) => p.category).filter((c) => c && !CATEGORIES.includes(c)))]).map((c) => ({ c, items: filtered.filter((p) => (p.category || 'General') === c) })).filter((g) => g.items.length);

  return (
    <AppShell>
      <PageHeader
        title="Catálogo de procedimientos"
        subtitle="Precios, costos de laboratorio e insumos que consume cada procedimiento."
        actions={admin && (
          <>
            <button className="btn-secondary" onClick={() => api('/procedures/seed', { method: 'POST' }).then((r) => { setMsg(r.message); load(); }).catch((e) => setError(e.message))}>Cargar catálogo base</button>
            <button className="btn-primary" onClick={() => setEdit({ name: '', code: '', category: 'General', price: 0, labCost: 0, durationMin: 30 })}><Icon name="plus" size={18} /> Procedimiento</button>
          </>
        )}
      />
      <ErrorBox error={error} onClose={() => setError('')} />
      {msg && <Notice tone="success">{msg}</Notice>}
      <input className="mb-4 max-w-sm" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list ? <Spinner /> : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.c} className="card overflow-x-auto">
              <div className="border-b border-line bg-[#f8fafb] px-4 py-2 text-[13px] font-semibold text-ink">{g.c}</div>
              <table className="w-full text-sm">
                <tbody>
                  {g.items.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5"><span className="font-medium">{p.name}</span>{p.code && <span className="ml-2 text-xs text-slate-400">{p.code}</span>}</td>
                      <td className="px-4 text-right tabular-nums font-semibold">{money(p.price)}</td>
                      <td className="px-4 text-right tabular-nums text-xs text-slate-500">{Number(p.labCost) ? `lab. ${money(p.labCost)}` : ''}</td>
                      <td className="px-4 text-right text-slate-500">{p.durationMin ? `${p.durationMin} min` : '—'}</td>
                      <td className="px-4 text-right whitespace-nowrap space-x-3">
                        <button className="text-xs font-semibold text-slate-600" onClick={() => openRecipe(p)}>Insumos</button>
                        {admin && <button className="text-xs font-semibold text-brand-700" onClick={() => setEdit({ ...p, price: Number(p.price), labCost: Number(p.labCost || 0) })}>Editar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? 'Editar procedimiento' : 'Nuevo procedimiento'} onClose={() => setEdit(null)}>
        {edit && (
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Nombre *</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></div>
            <div><label className="label">Categoría</label><select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Código</label><input value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></div>
            <div><label className="label">Precio (USD)</label><input type="number" min={0} step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></div>
            <div><label className="label">Costo de laboratorio</label><input type="number" min={0} step="0.01" value={edit.labCost} onChange={(e) => setEdit({ ...edit, labCost: e.target.value })} /></div>
            <div><label className="label">Duración (min)</label><input type="number" min={5} value={edit.durationMin || 30} onChange={(e) => setEdit({ ...edit, durationMin: e.target.value })} /></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary">Guardar</button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!recipe} title={`Receta de consumo · ${recipe?.procedure.name || ''}`} onClose={() => setRecipe(null)}>
        {recipe && (
          <form onSubmit={saveRecipe} className="space-y-3">
            <p className="text-sm text-slate-500">Insumos que se descuentan automáticamente del inventario cuando una cita con este procedimiento pasa a <strong>Atendido</strong>.</p>
            {recipe.items.map((it: any, i: number) => (
              <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2">
                <select value={it.productId} disabled={!admin} onChange={(e) => setRecipe({ ...recipe, items: recipe.items.map((x: any, j: number) => (j === i ? { ...x, productId: e.target.value } : x)) })}>
                  <option value="">Producto…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                </select>
                <input type="number" min={0.01} step="0.01" disabled={!admin} value={it.quantity} onChange={(e) => setRecipe({ ...recipe, items: recipe.items.map((x: any, j: number) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)) })} />
                {admin && <button type="button" className="btn-secondary !px-2" onClick={() => setRecipe({ ...recipe, items: recipe.items.filter((_: any, j: number) => j !== i) })} aria-label="Quitar"><Icon name="close" size={16} /></button>}
              </div>
            ))}
            {recipe.items.length === 0 && <p className="text-sm text-slate-400">Sin insumos configurados.</p>}
            {admin && (
              <>
                <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setRecipe({ ...recipe, items: [...recipe.items, { productId: '', quantity: 1 }] })}>+ Agregar insumo</button>
                <div className="flex justify-end"><button className="btn-primary">Guardar receta</button></div>
              </>
            )}
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

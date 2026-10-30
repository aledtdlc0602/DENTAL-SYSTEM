/** Abre una ventana imprimible (receta, consentimiento, presupuesto). */
export function openPrint(title: string, body: string) {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return alert('Permita las ventanas emergentes para imprimir');
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b1f2e;margin:32px;font-size:13px;line-height:1.5}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:20px 0 6px} .muted{color:#64748b}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border-bottom:1px solid #e2e8f0;padding:6px 4px;text-align:left}
  .head{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:10px;margin-bottom:16px}
  .sign{margin-top:48px;display:flex;gap:48px} .sign div{flex:1;border-top:1px solid #0b1f2e;padding-top:4px;text-align:center}
  img.sig{max-height:90px;display:block;margin:0 auto 4px}
  @media print{button{display:none}}
</style></head><body>${body}<p style="margin-top:32px"><button onclick="window.print()">Imprimir</button></p></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

export function escapeHtml(s: any) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Limpia HTML de plantillas (quita scripts, iframes y atributos on*). */
export function sanitizeHtml(html: string) {
  return String(html || '')
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
}

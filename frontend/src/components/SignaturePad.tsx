'use client';

import { useEffect, useRef, useState } from 'react';

/** RF-06: captura de firma manuscrita en tablet / pantalla táctil (Pointer Events). */
export default function SignaturePad({ onChange, height = 180 }: { onChange: (dataUrl: string | null) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    canvas.width = w * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1f2e';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, height);
  }, [height]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext('2d');
    const p = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d');
    const p = pos(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
    if (empty) setEmpty(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (!empty && ref.current) onChange(ref.current.toDataURL('image/png'));
  }
  function clear() {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={ref}
          style={{ width: '100%', height, touchAction: 'none' }}
          className="block rounded-lg cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">Firme aquí con el dedo o el lápiz</span>}
        <span className="pointer-events-none absolute left-6 right-6 bottom-8 border-b border-slate-200" />
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={clear}>
          Borrar firma
        </button>
      </div>
    </div>
  );
}

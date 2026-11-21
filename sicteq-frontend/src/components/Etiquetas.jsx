import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { code39Svg } from '../barcode';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { nombreEstado, varianteEstado } from '@/etapas';
import { cn } from '@/lib/utils';

// Un código con caracteres fuera de Code 39 no debe botar la pantalla entera.
const svgSeguro = (codigo, opts) => {
  try { return code39Svg(codigo, opts); } catch { return '<span style="color:#b91c1c;font-size:11px">Código no imprimible</span>'; }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// PB-06: etiqueta por caja con su código de barras. El lector USB "escribe"
// el código y manda Enter, así que en Ciclo/Autoclave basta con escanearla.
function imprimir(cajas) {
  const etiquetas = cajas.map(c => `
    <div class="et">
      <div class="cab">SICTEQ · Central de Esterilización HFRZ</div>
      ${svgSeguro(c.codigo_caja, { alto: 50, modulo: 1.5 })}
      <div class="cod">${esc(c.codigo_caja)}</div>
      <div class="tipo">${esc(c.nombre_equipo)}</div>
    </div>`).join('');
  const w = window.open('', '_blank');
  if (!w) { alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas SICTEQ</title><style>
    @page { margin: 8mm; }
    body { font-family: Arial, sans-serif; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .et { border: 1px dashed #999; padding: 3mm; text-align: center; break-inside: avoid; }
    .et svg { width: 100%; height: 50px; }
    .cab { font-size: 8pt; color: #444; margin-bottom: 2mm; }
    .cod { font: bold 14pt monospace; letter-spacing: 1px; }
    .tipo { font-size: 9pt; color: #333; }
  </style></head><body><div class="grid">${etiquetas}</div></body></html>`);
  w.document.close();
  // Sin <script> en la ventana: la política CSP (script-src 'self') lo bloquearía.
  w.focus();
  w.print();
}

export default function Etiquetas() {
  const [cajas, setCajas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [sel, setSel] = useState(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/cajas/circulacion')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`)))
      .then(setCajas)
      .catch(e => setError('No se pudieron cargar las cajas: ' + e.message));
  }, []);

  const f = filtro.trim().toUpperCase();
  const visibles = cajas.filter(c => !f || c.codigo_caja.includes(f) || String(c.nombre_equipo).toUpperCase().includes(f));
  const toggle = (codigo) => setSel(prev => {
    const n = new Set(prev);
    n.has(codigo) ? n.delete(codigo) : n.add(codigo);
    return n;
  });
  const todasVisibles = visibles.length > 0 && visibles.every(c => sel.has(c.codigo_caja));
  const toggleTodas = () => setSel(prev => {
    const n = new Set(prev);
    visibles.forEach(c => todasVisibles ? n.delete(c.codigo_caja) : n.add(c.codigo_caja));
    return n;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="max-w-3xl text-muted-foreground">Marque las cajas y presione Imprimir. Cada etiqueta lleva el código de barras: después basta con escanearla en Seguimiento de cajas o en Cargas de autoclave.</p>

      {error && <p role="alert" className="rounded-md border border-danger/40 bg-danger/15 p-3 text-sm font-bold text-danger">{error}</p>}

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar por código o tipo de caja" aria-label="Filtrar cajas" className="min-w-[220px] flex-1" />
          <span className="font-mono text-sm text-muted-foreground">{sel.size} marcada{sel.size === 1 ? '' : 's'}</span>
          <Button disabled={sel.size === 0} onClick={() => imprimir(cajas.filter(c => sel.has(c.codigo_caja)))}>
            <i className="fa-solid fa-print" aria-hidden="true"></i> Imprimir etiquetas
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10"><input type="checkbox" className="h-4 w-4 accent-primary" checked={todasVisibles} onChange={toggleTodas} aria-label="Marcar todas las visibles" /></TableHead>
              <TableHead>Caja</TableHead>
              <TableHead>Tipo de caja</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vista previa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map(c => (
              <TableRow key={c.id} className={cn('cursor-pointer', sel.has(c.codigo_caja) && 'bg-primary/10 hover:bg-primary/10')} onClick={() => toggle(c.codigo_caja)}>
                <TableCell><input type="checkbox" className="h-4 w-4 accent-primary" checked={sel.has(c.codigo_caja)} onChange={() => toggle(c.codigo_caja)} onClick={e => e.stopPropagation()} aria-label={`Marcar ${c.codigo_caja}`} /></TableCell>
                <TableCell className="font-mono font-bold">{c.codigo_caja}</TableCell>
                <TableCell>{c.nombre_equipo}</TableCell>
                <TableCell><Badge variant={varianteEstado(c.estado_nuevo)}>{nombreEstado(c.estado_nuevo)}</Badge></TableCell>
                <TableCell><div className="w-40 overflow-hidden rounded-sm" dangerouslySetInnerHTML={{ __html: svgSeguro(c.codigo_caja, { alto: 28, modulo: 1 }) }} /></TableCell>
              </TableRow>
            ))}
            {visibles.length === 0 && !error && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan="5" className="py-8 text-center text-muted-foreground">No hay cajas que coincidan.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

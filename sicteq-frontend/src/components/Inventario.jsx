import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const estadoDe = (item) => {
  if (item.estado_actual === 'Alerta' || item.cantidad_disponible <= item.stock_critico) return 'danger';
  if (['Sucio', 'Merma', 'En Reparación'].includes(item.estado_actual)) return 'warn';
  return 'ok';
};

export default function Inventario() {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/inventario`)
      .then(res => res.json())
      .then(data => setStockData(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error al cargar inventario:", err))
      .finally(() => setLoading(false));
  }, []);

  const enAlerta = stockData.filter(i => estadoDe(i) !== 'ok').length;

  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Stock por tipo de caja</CardTitle>
          <CardDescription>{loading ? 'Cargando…' : `${stockData.length} tipos de caja · ${enAlerta} requieren atención`}</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tipo de caja</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="w-56">Disponibles</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockData.map((item) => {
              const variante = estadoDe(item);
              const pct = item.cantidad_total > 0 ? Math.min(100, (item.cantidad_disponible / item.cantidad_total) * 100) : 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-bold">{item.nombre_equipo}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-muted-foreground">{item.codigo_barra || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="w-14 shrink-0 font-mono font-bold tabular-nums">{item.cantidad_disponible}<span className="text-muted-foreground"> / {item.cantidad_total}</span></span>
                      <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden="true">
                        <div className={`h-2 rounded-full ${variante === 'ok' ? 'bg-ok' : variante === 'warn' ? 'bg-warn' : 'bg-danger'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={variante}>{item.estado_actual || 'Sin estado'}</Badge></TableCell>
                </TableRow>
              );
            })}
            {!loading && stockData.length === 0 && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan="4" className="py-8 text-center text-muted-foreground">No hay inventario registrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

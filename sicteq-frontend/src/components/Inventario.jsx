import React from 'react';

export default function Inventario() {
  const stockData = [
    { nombre: "Caja Traumatología N°2", piezas: "42 / 45", estado: "Piezas Faltantes", color: "red" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-400 uppercase text-xs font-semibold border-b border-slate-200">
            <th className="p-4">Nombre de la Caja</th>
            <th className="p-4">Piezas Totales</th>
            <th className="p-4">Estado Stock</th>
            <th className="p-4">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {stockData.map((item, index) => (
            <tr key={index} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 font-semibold text-slate-700">{item.nombre}</td>
              <td className="p-4 font-mono">{item.piezas}</td>
              <td className="p-4">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full bg-${item.color}-100 text-${item.color}-700`}>
                  {item.estado}
                </span>
              </td>
              <td className="p-4 text-xs font-bold text-sky-600 hover:underline cursor-pointer">
                Enviar a Reposición
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
import React, { useState } from 'react';
import Modal from './Modal';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });

  const dataDetalles = {
    lavado: { title: "Cajas en Área de Lavado", items: ["BOX-LAV-001", "BOX-LAV-042", "BOX-LAV-089"] },
    autoclave: { title: "Cajas en Autoclave", items: ["BOX-AUT-302", "BOX-AUT-305"] },
    listas: { title: "Cajas Listas para Entrega", items: ["BOX-OK-100", "BOX-OK-204", "BOX-OK-205", "BOX-OK-210"] },
    mermas: { title: "Alertas / Mermas Activas", items: ["CRIT-MER-02"] }
  };

  const tableData = [
    { folio: "#FOL-1042", caja: "Caja Traumatología Mayor", destino: "Pabellón Central", estado: "En Autoclave", actualizacion: "Hoy, 16:45", color: "blue" },
    { folio: "#FOL-1041", caja: "Caja Cirugía Menor", destino: "Urgencias", estado: "Despachado", actualizacion: "Hoy, 15:30", color: "emerald" },
    { folio: "#FOL-1040", caja: "Set Instrumental Básico", destino: "Maternidad", estado: "Lavado Clínico", actualizacion: "Hoy, 14:15", color: "indigo" },
    { folio: "#FOL-1039", caja: "Motor Quirúrgico", destino: "Pabellón Central", estado: "Alerta Merma", actualizacion: "Hoy, 10:05", color: "amber" },
  ];

  const openModal = (category) => {
    setModalContent(dataDetalles[category]);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Resumen de Esterilización</h2>
        <p className="text-slate-500 text-sm mt-1">Métricas en tiempo real del ciclo quirúrgico.</p>
      </div>

      {/* Cuadrícula de Tarjetas con Hover States exactos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { id: 'lavado', title: 'Cajas en Proceso', val: '24', color: 'blue', icon: 'fa-boxes-stacked', hoverBorder: 'hover:border-sky-400' },
          { id: 'autoclave', title: 'Listas / Despachadas', val: '18', color: 'emerald', icon: 'fa-check-double', hoverBorder: 'hover:border-amber-400' },
          { id: 'listas', title: 'Alertas de Merma', val: '3', color: 'amber', icon: 'fa-triangle-exclamation', hoverBorder: 'hover:border-emerald-400' },
          { id: 'mermas', title: 'Solicitudes Pabellón', val: '5', color: 'purple', icon: 'fa-clipboard-list', hoverBorder: 'hover:border-red-400' }
        ].map((card) => (
          <div key={card.id} onClick={() => openModal(card.id)} className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 transition-all hover:-translate-y-1 cursor-pointer group ${card.hoverBorder}`}>
            <div className={`w-12 h-12 rounded-full bg-${card.color}-100 flex items-center justify-center text-${card.color}-600 text-xl`}>
              <i className={`fa-solid ${card.icon}`}></i>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{card.title}</p>
              <p className="text-2xl font-bold text-slate-800">{card.val}</p>
              <span className={`text-[11px] text-${card.color}-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity`}>
                <i className="fa-solid fa-eye mr-1"></i>Ver detalle
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de Trazabilidad */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Últimos Movimientos de Trazabilidad</h3>
          <button className="text-sm text-sky-600 font-semibold hover:text-sky-700 transition-colors">Ver todo</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Folio</th>
                <th className="px-6 py-3 font-semibold">Caja / Instrumental</th>
                <th className="px-6 py-3 font-semibold">Destino</th>
                <th className="px-6 py-3 font-semibold">Estado Actual</th>
                <th className="px-6 py-3 font-semibold">Última Actualización</th>
                <th className="px-6 py-3 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map((mov, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{mov.folio}</td>
                  <td className="px-6 py-4">{mov.caja}</td>
                  <td className="px-6 py-4">{mov.destino}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold bg-${mov.color}-100 text-${mov.color}-700 border border-${mov.color}-200`}>
                      {mov.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">{mov.actualizacion}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-slate-400 hover:text-sky-600 transition-colors"><i className="fa-solid fa-eye"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla de Solicitudes Críticas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-truck-medical text-red-500"></i> Solicitudes Críticas de Pabellón Quirúrgico
            </h3>
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full animate-pulse">Urgencias Médicas Activas</span>
        </div>
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase text-xs font-semibold border-b border-slate-200">
                    <th className="p-4">ID Cirugía</th>
                    <th className="p-4">Caja Requerida</th>
                    <th className="p-4">Pabellón</th>
                    <th className="p-4">Estado Actual</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
                <tr>
                    <td className="p-4 font-bold text-slate-700">C-204</td>
                    <td className="p-4">Set Laparoscopía Avanzada</td>
                    <td className="p-4">Pabellón 3 (Urgencias)</td>
                    <td className="p-4"><span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">En Preparación</span></td>
                </tr>
                <tr>
                    <td className="p-4 font-bold text-slate-700">C-210</td>
                    <td className="p-4">Set Traumatología Cadera</td>
                    <td className="p-4">Pabellón 1 (Programada)</td>
                    <td className="p-4"><span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">Listo</span></td>
                </tr>
            </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalContent.title}>
        <ul className="divide-y divide-slate-100 text-sm mb-4">
          {modalContent.items.map((item, index) => (
            <li key={index} className="py-3 text-slate-700 font-medium flex items-center">
              <i className="fa-solid fa-box mr-3 text-slate-400"></i> {item}
            </li>
          ))}
        </ul>
        <button onClick={() => setIsModalOpen(false)} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">Cerrar</button>
      </Modal>
    </div>
  );
}
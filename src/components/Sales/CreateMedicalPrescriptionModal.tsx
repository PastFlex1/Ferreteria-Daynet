import React, { useState } from 'react';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { Stethoscope, X, User, Activity, AlertCircle, Calendar } from 'lucide-react';
import { Customer } from '../../types';

interface CreateMedicalPrescriptionModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
}

export const CreateMedicalPrescriptionModal: React.FC<CreateMedicalPrescriptionModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientDocId: '',
    doctorName: '',
    doctorRegistryNumber: '',
    prescriptionNumber: '',
    items: '',
    issueDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: `REC-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      ...formData,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-950 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500/20 flex items-center justify-center rounded-xl border border-orange-500/30">
              <Stethoscope className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Registrar Receta Médica</h2>
              <p className="text-slate-400 text-xs font-medium">Control de sustancias restringidas y medicamentos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Datos del Paciente / Comprador
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Nombre del Paciente *</label>
                <input
                  type="text"
                  required
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Cédula / Documento *</label>
                <input
                  type="text"
                  required
                  value={formData.patientDocId}
                  onChange={(e) => setFormData({ ...formData, patientDocId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                  placeholder="Ej: 1712345678"
                />
              </div>
            </div>

            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mt-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" /> Datos del Médico Prescriptor
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Nombre del Médico *</label>
                <input
                  type="text"
                  required
                  value={formData.doctorName}
                  onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Ej: Dr. Roberto Gómez"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Registro Médico / Cód. MSP *</label>
                <input
                  type="text"
                  required
                  value={formData.doctorRegistryNumber}
                  onChange={(e) => setFormData({ ...formData, doctorRegistryNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                  placeholder="Ej: L3-4455"
                />
              </div>
            </div>

            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mt-6 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" /> Datos de la Receta
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Número de Prescripción *</label>
                <input
                  type="text"
                  required
                  value={formData.prescriptionNumber}
                  onChange={(e) => setFormData({ ...formData, prescriptionNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                  placeholder="Ej: REC-99384"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Fecha de Emisión *</label>
                <CustomDatePicker value={formData.issueDate} onChange={(val) => setFormData({ ...formData, issueDate: val })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-black text-slate-700">Medicamentos / Sustancias Autorizadas *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.items}
                  onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Escriba el detalle de los ítems de la receta"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-800 font-medium leading-relaxed">
              El registro de esta receta tiene carácter de declaración jurada y control legal según normativas del Ministerio de Salud. Verifique bien los datos del prescriptor.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Registrar y Autorizar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

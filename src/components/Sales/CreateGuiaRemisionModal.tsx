import React, { useState } from 'react';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { X, Truck, FileText, CheckCircle2 } from 'lucide-react';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';
import { useModal } from '../../context/ModalContext';

export interface GuiaRemisionData {
  id: string;
  invoiceRef: string;
  transporter: string;
  transporterRuc: string;
  plate: string;
  route: string;
  date: string;
  status: string;
}

interface CreateGuiaRemisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (guia: GuiaRemisionData) => void;
}

export function CreateGuiaRemisionModal({ isOpen, onClose, onSave }: CreateGuiaRemisionModalProps) {
  const { showAlert } = useModal();
  const [formData, setFormData] = useState({
    invoiceRef: '',
    transporter: '',
    transporterRuc: '',
    plate: '',
    origin: '',
    destination: '',
    date: new Date().toISOString().split('T')[0],
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.invoiceRef || !formData.transporter || !formData.transporterRuc || !formData.plate || !formData.origin || !formData.destination) {
      showAlert('Por favor, complete todos los campos obligatorios.', 'Faltan Datos', 'warning');
      return;
    }

    const rucValidation = validateEcuadorianDocument('AUTO', formData.transporterRuc);
    if (!rucValidation.isValid) {
      showAlert(rucValidation.message || 'El RUC del transportista es inválido.', 'Error de RUC', 'warning');
      return;
    }

    const newGuia: GuiaRemisionData = {
      id: `GR-001-${Math.floor(100000 + Math.random() * 900000)}`,
      invoiceRef: formData.invoiceRef,
      transporter: formData.transporter,
      transporterRuc: formData.transporterRuc,
      plate: formData.plate,
      route: `${formData.origin} -> ${formData.destination}`,
      date: formData.date,
      status: 'AUTORIZADO',
    };

    onSave(newGuia);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-900 text-orange-400 rounded-xl">
              <Truck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Nueva Guía de Remisión</h3>
              <p className="text-xs text-slate-500 font-medium">Emisión de documento de transporte</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="guiaForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-black text-slate-900 uppercase mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Datos del Comprobante
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Factura de Origen *</label>
                  <input
                    type="text"
                    value={formData.invoiceRef}
                    onChange={(e) => setFormData({ ...formData, invoiceRef: e.target.value })}
                    placeholder="Ej: F001-00000150"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Fecha de Traslado *</label>
                  <CustomDatePicker value={formData.date} onChange={(val) => setFormData({ ...formData, date: val })} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-black text-slate-900 uppercase mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-500" />
                Datos del Transportista
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">RUC Transportista *</label>
                  <input
                    type="text"
                    value={formData.transporterRuc}
                    onChange={(e) => setFormData({ ...formData, transporterRuc: e.target.value })}
                    placeholder="1790000000001"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Razón Social / Nombre *</label>
                  <input
                    type="text"
                    value={formData.transporter}
                    onChange={(e) => setFormData({ ...formData, transporter: e.target.value })}
                    placeholder="Transportes Rápidos S.A."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Placa del Vehículo *</label>
                  <input
                    type="text"
                    value={formData.plate}
                    onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                    placeholder="Ej: ABC-1234"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Punto de Partida (Origen) *</label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  placeholder="Ciudad, Dirección"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Punto de Llegada (Destino) *</label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="Ciudad, Dirección"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end space-x-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-700 font-bold text-xs rounded-xl border border-slate-300 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="guiaForm"
            className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl border border-slate-900 hover:bg-slate-800 transition flex items-center gap-2 shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Generar Guía</span>
          </button>
        </div>
      </div>
    </div>
  );
}

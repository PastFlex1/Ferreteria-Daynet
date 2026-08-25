import React, { useState } from 'react';
import { Settings, Save, Store, Building2, Receipt, CheckCircle2 } from 'lucide-react';
import { StoreSettings } from '../../types';

interface SettingsViewProps {
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800 shadow-2xs">
              <Store className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">Configuración de la Ferretería</h2>
              <p className="text-xs text-slate-500 font-medium">
                Ajusta los datos fiscales, impuestos y series de comprobantes para tus facturas.
              </p>
            </div>
          </div>

          {savedSuccess && (
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black flex items-center gap-1.5 animate-fadeIn shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span>Configuración Guardada</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Store Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Datos Fiscales de la Empresa</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social Legal *
                </label>
                <input
                  type="text"
                  required
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Identificación Fiscal (RFC / RUC / NIT) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-orange-600 font-mono font-bold rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teléfono de Atención
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dirección Comercial y Fiscal *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Currency & Tax Parameters */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <span>Impuestos & Series de Facturación</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Símbolo de Moneda
                </label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl text-xs text-center focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tasa de Impuesto IVA (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.defaultTaxRate}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl text-xs text-center focus:ring-2 focus:ring-orange-500"
                />
                <span className="block text-[10px] text-slate-500 mt-1 font-medium">
                  El IVA se desglosa del precio total (no se adiciona).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prefijo Serie Facturas
                </label>
                <input
                  type="text"
                  value={formData.invoicePrefix}
                  onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-orange-600 font-mono font-bold rounded-xl text-xs text-center focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pie de Página en Comprobante / Términos de Garantía
              </label>
              <textarea
                rows={2}
                value={formData.footerNotes}
                onChange={(e) => setFormData({ ...formData, footerNotes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black rounded-xl text-xs transition shadow-md shadow-orange-500/20 flex items-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Guardar Configuración Fiscal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

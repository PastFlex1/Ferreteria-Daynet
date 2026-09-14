import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Percent, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Eye, 
  FileCode, 
  Copy, 
  Check, 
  Trash2, 
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Settings,
  X
} from 'lucide-react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { StoreSettings } from '../../types';
import { RetentionRecord, RetentionCatalogItem } from '../../types/retention';
import { CreateRetentionV2Modal } from './CreateRetentionV2Modal';
import { RetentionRidePdfService } from '../../services/retention/RetentionRidePdfService';
import { RetentionCatalogService } from '../../services/retention/RetentionCatalogService';
import { SriBackendService } from '../../services/sriBackendService';
import { formatCurrency, formatFullDate } from '../../utils/formatters';

interface RetentionManagementViewProps {
  settings: StoreSettings;
  establishment: string;
  emissionPoint: string;
  secRetention: string;
  onUpdateSecuencial?: (nextSec: string) => void;
}

export const RetentionManagementView: React.FC<RetentionManagementViewProps> = ({
  settings,
  establishment,
  emissionPoint,
  secRetention,
  onUpdateSecuencial,
}) => {
  // Retenciones almacenadas en Firestore y LocalStorage
  const [retenciones, setRetenciones] = useFirestoreSync<RetentionRecord[]>('ferreteria_retenciones_v2', []);
  const [purchases] = useFirestoreSync<any[]>('ferreteria_purchases', []);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [selectedRetentionView, setSelectedRetentionView] = useState<RetentionRecord | null>(null);

  // Notificación de copia
  const [copiedClave, setCopiedClave] = useState<string | null>(null);

  // Copiar al portapapeles
  const handleCopyClave = (clave: string) => {
    navigator.clipboard.writeText(clave);
    setCopiedClave(clave);
    setTimeout(() => setCopiedClave(null), 2500);
  };

  // Guardar nueva retención emitida
  const handleSaveRetention = (record: RetentionRecord) => {
    setRetenciones([record, ...retenciones]);
    setIsCreateModalOpen(false);

    // Incrementar secuencial para la próxima emisión
    const nextVal = String(parseInt(record.secuencial, 10) + 1);
    if (onUpdateSecuencial) {
      onUpdateSecuencial(nextVal);
    }
  };

  // Descarga de XML
  const handleDownloadXml = (retention: RetentionRecord) => {
    const xmlContent = retention.xmlAutorizado || retention.xmlFirmado || retention.xmlGenerado;
    if (!xmlContent) {
      alert('No se encuentra disponible el contenido XML para este comprobante.');
      return;
    }
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Retencion_${retention.id || retention.secuencial}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Descarga de RIDE PDF
  const handleDownloadRide = (retention: RetentionRecord) => {
    RetentionRidePdfService.downloadPdf(retention, settings);
  };

  // Re-consultar estado en el SRI
  const handleRecheckSri = async (retention: RetentionRecord) => {
    if (!retention.claveAcceso) return;
    try {
      const res = await SriBackendService.autorizarSri(retention.claveAcceso, 3, 1500);
      if (res.success && res.autorizacion) {
        const isAut = res.autorizacion.includes('AUTORIZADO');
        if (isAut) {
          const numMatch = res.autorizacion.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/);
          const fechaMatch = res.autorizacion.match(/<fechaAutorizacion.*?>(.*?)<\/fechaAutorizacion>/);

          setRetenciones((prev) =>
            prev.map((r) =>
              r.id === retention.id
                ? {
                    ...r,
                    estado: 'AUTORIZADO',
                    numeroAutorizacion: numMatch ? numMatch[1] : r.claveAcceso,
                    fechaAutorizacion: fechaMatch ? fechaMatch[1] : new Date().toISOString(),
                    xmlAutorizado: res.autorizacion,
                  }
                : r
            )
          );
          alert('¡Comprobante de retención actualizado a AUTORIZADO por el SRI!');
        } else {
          alert(`Respuesta del SRI: ${res.autorizacion.substring(0, 200)}...`);
        }
      }
    } catch (e: any) {
      alert(`Error al consultar el SRI: ${e.message}`);
    }
  };

  // Filtrado de la tabla
  const filteredRetenciones = retenciones.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.claveAcceso.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sujetoRetenido.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sujetoRetenido.identificacion.includes(searchTerm);

    const matchesStatus = statusFilter === 'TODOS' || r.estado === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Catálogo completo
  const catalogList = RetentionCatalogService.getAll();

  return (
    <div className="space-y-6">
      {/* 1. Header con métricas y botón de emisión */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800 shadow-md">
            <Percent className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Comprobantes Electrónicos de Retención
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                Esquema ATS v2.0.0 (codDoc 07)
              </span>
            </div>
            <p className="text-slate-500 text-xs font-medium">
              Ambiente SRI: <b className="text-slate-800">{localStorage.getItem('ferreteria_settings_ambiente') === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}</b> • Secuencial Actual: <b className="font-mono text-orange-600">{establishment}-{emissionPoint}-{secRetention}</b>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCatalogModalOpen(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-slate-200"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Catálogo Versionado</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-orange-500/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Emitir Retención SRI</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Búsqueda y Filtros */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por secuencial, RUC, proveedor o clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500">Estado SRI:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="AUTORIZADO">AUTORIZADO</option>
            <option value="RECIBIDA">RECIBIDA</option>
            <option value="DEVUELTA">DEVUELTA</option>
            <option value="PENDIENTE">PENDIENTE</option>
          </select>
        </div>
      </div>

      {/* 3. Tabla Principal de Comprobantes de Retención */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-white uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">N° Comprobante</th>
                <th className="py-3 px-4">Fecha / Período</th>
                <th className="py-3 px-4">Proveedor (Sujeto Retenido)</th>
                <th className="py-3 px-4">Clave de Acceso SRI</th>
                <th className="py-3 px-4 text-right">Ret. RIR</th>
                <th className="py-3 px-4 text-right">Ret. IVA</th>
                <th className="py-3 px-4 text-right">Total Retenido</th>
                <th className="py-3 px-4 text-center">Estado SRI</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium">
              {filteredRetenciones.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                    <Percent className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No hay retenciones registradas.</p>
                    <p className="text-[11px] text-slate-400">
                      Haga clic en "Emitir Retención SRI" para registrar un nuevo comprobante legal.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRetenciones.map((r) => {
                  const isAut = r.estado === 'AUTORIZADO';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* N° Comprobante */}
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        {r.id}
                      </td>

                      {/* Fecha y Período */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{r.fechaEmision}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Período: {r.periodoFiscal}</span>
                      </td>

                      {/* Proveedor */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="font-bold text-slate-900 block truncate" title={r.sujetoRetenido.razonSocial}>
                          {r.sujetoRetenido.razonSocial}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {r.sujetoRetenido.identificacion}
                        </span>
                      </td>

                      {/* Clave de Acceso */}
                      <td className="py-3 px-4 font-mono text-[10px]">
                        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200/80 w-fit">
                          <span className="truncate max-w-[140px] text-slate-700" title={r.claveAcceso}>
                            {r.claveAcceso ? `${r.claveAcceso.substring(0, 10)}...${r.claveAcceso.substring(39)}` : '-'}
                          </span>
                          {r.claveAcceso && (
                            <button
                              onClick={() => handleCopyClave(r.claveAcceso)}
                              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                              title="Copiar Clave Completa"
                            >
                              {copiedClave === r.claveAcceso ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Retención Renta */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                        ${r.totalRetenidoRenta.toFixed(2)}
                      </td>

                      {/* Retención IVA */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                        ${r.totalRetenidoIva.toFixed(2)}
                      </td>

                      {/* Total Retenido */}
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        ${r.totalRetenido.toFixed(2)}
                      </td>

                      {/* Estado SRI */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isAut
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : r.estado === 'DEVUELTA'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : r.estado === 'RECIBIDA'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isAut ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>{r.estado}</span>
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleDownloadRide(r)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Descargar RIDE PDF Oficial"
                          >
                            <Download className="w-4 h-4 text-orange-600" />
                          </button>

                          <button
                            onClick={() => handleDownloadXml(r)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Descargar XML Autorizado / Firmado"
                          >
                            <FileCode className="w-4 h-4 text-slate-600" />
                          </button>

                          {!isAut && (
                            <button
                              onClick={() => handleRecheckSri(r)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                              title="Re-consultar Autorización en SRI"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Emisión */}
      {isCreateModalOpen && (
        <CreateRetentionV2Modal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleSaveRetention}
          settings={settings}
          establishment={establishment}
          emissionPoint={emissionPoint}
          secRetention={secRetention}
          purchases={purchases}
        />
      )}

      {/* Modal de Catálogo Versionado SRI */}
      {isCatalogModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 animate-fadeIn my-auto flex flex-col max-h-[90vh] overflow-hidden">
              {/* Header Fijo */}
              <div className="flex-shrink-0 bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/30 rounded-xl flex items-center justify-center text-orange-400">
                    <Percent className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      Catálogo Tributario Versionado SRI
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5 font-medium">
                      Res. NAC-DGERCGC26-00000009 (AIR) • Tabla 19 ATS (IVA) • Tablas 3 y 4 ATS
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span>Total de códigos parametrizados vigentes: <b className="text-slate-900 font-mono">{catalogList.length}</b></span>
                  <button
                    onClick={() => {
                      RetentionCatalogService.resetToDefault();
                      alert('Catálogo restablecido a los valores oficiales del SRI.');
                    }}
                    className="text-orange-600 hover:text-orange-700 hover:underline font-bold cursor-pointer text-left sm:text-right"
                  >
                    Restablecer a Semilla Oficial SRI
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead className="bg-slate-950 text-white uppercase text-[10px] font-black tracking-wider">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">Impuesto</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Código SRI</th>
                        <th className="py-3 px-3.5 min-w-[280px]">Descripción Oficial</th>
                        <th className="py-3 px-3.5 text-right whitespace-nowrap">Tarifa</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Vigencia Desde</th>
                        <th className="py-3 px-3.5 min-w-[200px]">Base Legal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium bg-white">
                      {catalogList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-block ${
                                item.taxType === 'RENTA'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}
                            >
                              {item.taxType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-black text-slate-900 whitespace-nowrap">{item.sriCode}</td>
                          <td className="py-2.5 px-3.5 text-slate-800 font-medium min-w-[280px]">{item.description}</td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                            {item.percentage.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-600 font-mono text-xs whitespace-nowrap">{item.validFrom}</td>
                          <td className="py-2.5 px-3.5 text-slate-500 text-[11px] min-w-[200px]">{item.legalSource}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Fijo */}
              <div className="flex-shrink-0 bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="px-6 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

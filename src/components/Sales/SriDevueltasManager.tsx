/**
 * @fileOverview Gestor y Bandeja Oficial de Facturas Devueltas por el SRI.
 * Muestra el estado oficial 'DEVUELTA', el motivo exacto del SRI originado en inconsistencias
 * del documento (RUC/Cédula, Fechas, Secuenciales o Descuadre de IVA), y provee herramientas
 * totalmente automatizadas de diagnóstico, corrección y reenvío.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  RotateCcw, 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles, 
  FileText, 
  Eye, 
  Pencil, 
  Send, 
  ShieldAlert, 
  HelpCircle,
  TrendingDown,
  X,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  Check,
  Wifi,
  WifiOff,
  Server
} from 'lucide-react';
import { Customer, Invoice, Product, StoreSettings } from '../../types';
import { formatCurrency, formatFullDate } from '../../utils/formatters';
import { useModal } from '../../context/ModalContext';
import { 
  diagnosticarFacturaSri, 
  SriDocumentDiagnostic 
} from '../../utils/sriDocumentValidation';
import { SriBackendService } from '../../services/sriBackendService';
import { SriCorrectionModal } from './SriCorrectionModal';
import { SriEmissionProgressModal } from '../POS/SriEmissionProgressModal';

interface SriDevueltasManagerProps {
  invoices: Invoice[];
  customers: Customer[];
  products: Product[];
  settings: StoreSettings;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onOpenViewer?: (invoice: Invoice) => void;
}

export const SriDevueltasManager: React.FC<SriDevueltasManagerProps> = ({
  invoices,
  customers,
  products,
  settings,
  onUpdateInvoice,
  onOpenViewer,
}) => {
  const { showAlert } = useModal();

  // Estados locales
  const [searchTerm, setSearchTerm] = useState('');
  const [errorFilter, setErrorFilter] = useState<'TODOS' | 'IDENTIFICACION' | 'SECUENCIAL' | 'FECHA' | 'TOTALES'>('TODOS');
  const [selectedInvoiceForCorrection, setSelectedInvoiceForCorrection] = useState<Invoice | null>(null);
  const [selectedInvoiceForSriResend, setSelectedInvoiceForSriResend] = useState<Invoice | null>(null);
  const [isSriResendOpen, setIsSriResendOpen] = useState(false);
  const [auditModalInvoice, setAuditModalInvoice] = useState<{ invoice: Invoice; diag: SriDocumentDiagnostic } | null>(null);

  // Estados de conexión y sincronización con el API real SRI (Spring Boot Backend)
  const [apiStatus, setApiStatus] = useState<'IDLE' | 'CHECKING' | 'CONNECTED' | 'DISCONNECTED'>('IDLE');
  const [apiMessage, setApiMessage] = useState<string>('');
  const [isSyncingWithSri, setIsSyncingWithSri] = useState(false);
  const [singleCheckingId, setSingleCheckingId] = useState<string | null>(null);

  // Probar conectividad con el API al montar
  useEffect(() => {
    checkApiConnection();
  }, []);

  const checkApiConnection = async () => {
    setApiStatus('CHECKING');
    try {
      const res = await SriBackendService.testConnection();
      if (res.ok) {
        setApiStatus('CONNECTED');
        setApiMessage(res.message);
      } else {
        setApiStatus('DISCONNECTED');
        setApiMessage(res.message);
      }
    } catch {
      setApiStatus('DISCONNECTED');
      setApiMessage('No se pudo conectar con el backend API del SRI.');
    }
  };

  // Filtrado de comprobantes devueltos
  const devueltasList = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.documentType !== 'FACTURA') return false;
      const isDevueltaStatus = inv.sriStatus === 'DEVUELTA' || inv.sriStatus === 'NO AUTORIZADO';
      const isErrorWithMsg = inv.sriStatus === 'ERROR' && !!inv.sriMensaje;
      return isDevueltaStatus || isErrorWithMsg;
    });
  }, [invoices]);

  // Diagnóstico precalculado por factura
  const diagnosticsMap = useMemo(() => {
    const map = new Map<string, SriDocumentDiagnostic>();
    devueltasList.forEach((inv) => {
      map.set(inv.id, diagnosticarFacturaSri(inv, invoices));
    });
    return map;
  }, [devueltasList, invoices]);

  // Filtro de búsqueda y categoría de error
  const filteredDevueltas = useMemo(() => {
    return devueltasList.filter((inv) => {
      const diag = diagnosticsMap.get(inv.id);

      // Filtro por tipo de error
      if (errorFilter !== 'TODOS') {
        if (diag?.campoAfectado !== errorFilter) return false;
      }

      // Filtro por texto
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const num = String(inv.fullNumber || inv.number || '').toLowerCase();
      const client = (inv.customer?.name || '').toLowerCase();
      const idNum = String(inv.customer?.docNumber || inv.customer?.idNumber || '').toLowerCase();
      const msg = (inv.sriMensaje || '').toLowerCase();
      const code = (diag?.codigoError || '').toLowerCase();

      return (
        num.includes(term) ||
        client.includes(term) ||
        idNum.includes(term) ||
        msg.includes(term) ||
        code.includes(term)
      );
    });
  }, [devueltasList, diagnosticsMap, errorFilter, searchTerm]);

  // Métricas
  const totalMontoDevuelto = devueltasList.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
  const errIdentificacionCount = devueltasList.filter((i) => diagnosticsMap.get(i.id)?.campoAfectado === 'IDENTIFICACION').length;
  const errSecuencialCount = devueltasList.filter((i) => diagnosticsMap.get(i.id)?.campoAfectado === 'SECUENCIAL').length;
  const errFechaCount = devueltasList.filter((i) => diagnosticsMap.get(i.id)?.campoAfectado === 'FECHA').length;
  const errTotalesCount = devueltasList.filter((i) => diagnosticsMap.get(i.id)?.campoAfectado === 'TOTALES').length;

  // 1. Diagnóstico Automático Masivo:
  // Escanea comprobantes que tengan anomalías y los actualiza a DEVUELTA con motivo SRI
  const handleAutoDiagnoseAll = () => {
    if (!onUpdateInvoice) {
      showAlert('No se puede actualizar el listado de facturas en este contexto.', 'SRI', 'warning');
      return;
    }

    let marcadas = 0;
    invoices.forEach((inv) => {
      if (inv.documentType === 'FACTURA' && inv.sriStatus !== 'AUTORIZADO') {
        const diag = diagnosticarFacturaSri(inv, invoices);
        if (!diag.esValido && inv.sriStatus !== 'DEVUELTA') {
          const updated: Invoice = {
            ...inv,
            sriStatus: 'DEVUELTA',
            sriMensaje: diag.motivoSri || 'Comprobante devuelto por inconsistencia en datos del documento.',
          };
          onUpdateInvoice(updated);
          marcadas++;
        }
      }
    });

    if (marcadas > 0) {
      showAlert(
        `Diagnóstico completado con éxito: Se identificaron y marcaron ${marcadas} facturas con inconsistencias documentales en estado DEVUELTA.`,
        'Diagnóstico Automático SRI',
        'success'
      );
    } else {
      showAlert(
        'Diagnóstico completado: Todas las facturas no autorizadas cumplen con las validaciones de estructura o ya están catalogadas en la bandeja de devueltas.',
        'Diagnóstico Automático SRI',
        'info'
      );
    }
  };

  // 2. Sincronización Real con el Web Service Oficial del SRI mediante la API
  const handleSyncWithSriApi = async () => {
    if (!onUpdateInvoice) {
      showAlert('No se puede actualizar el listado de facturas en este contexto.', 'SRI', 'warning');
      return;
    }

    setIsSyncingWithSri(true);

    try {
      // 1. Probar conectividad con el API
      const conn = await SriBackendService.testConnection();
      if (!conn.ok) {
        setApiStatus('DISCONNECTED');
        showAlert(
          `No se pudo comunicar con el API SRI (${SriBackendService.getBaseUrl()}). Asegúrate de tener en ejecución tu servidor Spring Boot local. Error: ${conn.message}`,
          'API SRI Desconectada',
          'error'
        );
        setIsSyncingWithSri(false);
        return;
      }
      setApiStatus('CONNECTED');

      // 2. Facturas que tienen clave de acceso y no están autorizadas o están en estado DEVUELTA / PENDIENTE
      const invoicesToSync = invoices.filter(
        (inv) => inv.documentType === 'FACTURA' && inv.sriClaveAcceso && inv.sriStatus !== 'AUTORIZADO'
      );

      if (invoicesToSync.length === 0) {
        showAlert(
          'No hay facturas con Clave de Acceso generada pendientes de consultar en el SRI. Para facturas observadas o pendientes, utiliza los botones "Corregir" o "Reenviar" para transmitirlas por el API.',
          'Sincronización con API SRI',
          'info'
        );
        setIsSyncingWithSri(false);
        return;
      }

      let autorizadas = 0;
      let devueltas = 0;
      let enProceso = 0;

      for (const inv of invoicesToSync) {
        try {
          const res = await SriBackendService.autorizarSri(inv.sriClaveAcceso!);
          if (res.success && res.autorizacion) {
            const authXml = res.autorizacion;
            const isAutorizado = authXml.toUpperCase().includes('AUTORIZADO') && !authXml.toUpperCase().includes('NO AUTORIZADO');
            const isNoAutorizado = authXml.toUpperCase().includes('NO AUTORIZADO') || authXml.toUpperCase().includes('DEVUELTA');

            const numMatch = authXml.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/i);
            const fechaMatch = authXml.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/i);

            // Extraer mensajes oficiales del SRI
            const devMsgs: string[] = [];
            const msgRegex = /<mensaje>([\s\S]*?)<\/mensaje>/gi;
            let m;
            while ((m = msgRegex.exec(authXml)) !== null) {
              const block = m[1];
              const textM = block.match(/<mensaje>(.*?)<\/mensaje>/i) || [null, block];
              const identM = block.match(/<identificador>(.*?)<\/identificador>/i);
              const infoM = block.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
              const idStr = identM ? `[ERROR ${identM[1]}] ` : '';
              const msgStr = textM[1] ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
              const infoStr = infoM ? ` -> ${infoM[1].trim()}` : '';
              if (msgStr) devMsgs.push(`${idStr}${msgStr}${infoStr}`);
            }

            if (isAutorizado) {
              const updated: Invoice = {
                ...inv,
                sriStatus: 'AUTORIZADO',
                sriNumeroAutorizacion: numMatch ? numMatch[1] : inv.sriClaveAcceso,
                sriFechaAutorizacion: fechaMatch ? fechaMatch[1] : new Date().toISOString(),
                sriMensaje: 'Autorizado legalmente por el SRI.',
              };
              onUpdateInvoice(updated);
              autorizadas++;
            } else if (isNoAutorizado) {
              const updated: Invoice = {
                ...inv,
                sriStatus: 'DEVUELTA',
                sriMensaje: devMsgs.length > 0 ? devMsgs.join(' | ') : (inv.sriMensaje || 'Comprobante no autorizado / devuelto por el SRI.'),
              };
              onUpdateInvoice(updated);
              devueltas++;
            } else {
              enProceso++;
            }
          } else {
            enProceso++;
          }
        } catch {
          enProceso++;
        }
      }

      showAlert(
        `Sincronización completada con el API oficial del SRI:\n• ${autorizadas} factura(s) pasaron a estado AUTORIZADO.\n• ${devueltas} factura(s) confirmadas con observaciones del SRI (DEVUELTA).\n• ${enProceso} comprobante(s) continúan en trámite en el SRI.`,
        'Sincronización SRI Finalizada',
        'success'
      );
    } catch (err: any) {
      showAlert(`Error durante la sincronización: ${err?.message || 'Error de conexión'}`, 'SRI', 'error');
    } finally {
      setIsSyncingWithSri(false);
    }
  };

  // 3. Consultar estado en tiempo real de una factura individual en el SRI
  const handleCheckSingleInvoiceStatus = async (inv: Invoice) => {
    if (!inv.sriClaveAcceso) {
      showAlert('Esta factura no tiene una Clave de Acceso generada todavía. Haz clic en "Reenviar" para transmitirla mediante el API.', 'SRI', 'info');
      return;
    }

    setSingleCheckingId(inv.id);
    try {
      const res = await SriBackendService.autorizarSri(inv.sriClaveAcceso);
      if (res.success && res.autorizacion) {
        const authXml = res.autorizacion;
        const isAutorizado = authXml.toUpperCase().includes('AUTORIZADO') && !authXml.toUpperCase().includes('NO AUTORIZADO');
        const isNoAutorizado = authXml.toUpperCase().includes('NO AUTORIZADO') || authXml.toUpperCase().includes('DEVUELTA');
        const numMatch = authXml.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/i);
        const fechaMatch = authXml.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/i);

        const devMsgs: string[] = [];
        const msgRegex = /<mensaje>([\s\S]*?)<\/mensaje>/gi;
        let m;
        while ((m = msgRegex.exec(authXml)) !== null) {
          const block = m[1];
          const textM = block.match(/<mensaje>(.*?)<\/mensaje>/i) || [null, block];
          const identM = block.match(/<identificador>(.*?)<\/identificador>/i);
          const infoM = block.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
          const idStr = identM ? `[ERROR ${identM[1]}] ` : '';
          const msgStr = textM[1] ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
          const infoStr = infoM ? ` -> ${infoM[1].trim()}` : '';
          if (msgStr) devMsgs.push(`${idStr}${msgStr}${infoStr}`);
        }

        if (isAutorizado && onUpdateInvoice) {
          onUpdateInvoice({
            ...inv,
            sriStatus: 'AUTORIZADO',
            sriNumeroAutorizacion: numMatch ? numMatch[1] : inv.sriClaveAcceso,
            sriFechaAutorizacion: fechaMatch ? fechaMatch[1] : new Date().toISOString(),
            sriMensaje: 'Autorizado legalmente por el SRI.',
          });
          showAlert(`La factura ${inv.fullNumber} fue confirmada como AUTORIZADA por el SRI.`, 'SRI Autorizado', 'success');
        } else if (isNoAutorizado && onUpdateInvoice) {
          const msg = devMsgs.length > 0 ? devMsgs.join(' | ') : 'Comprobante observado o devuelto por el SRI.';
          onUpdateInvoice({
            ...inv,
            sriStatus: 'DEVUELTA',
            sriMensaje: msg,
          });
          showAlert(`Respuesta del SRI para ${inv.fullNumber}: DEVUELTA / NO AUTORIZADO.\n\nMotivo SRI:\n${msg}`, 'SRI Observación', 'warning');
        } else {
          showAlert(`El SRI respondió que el comprobante se encuentra: ${authXml.includes('EN PROCESO') ? 'EN PROCESO' : 'RECIBIDO (pendiente de resolución)'}.`, 'Estado SRI', 'info');
        }
      } else {
        showAlert(`No se pudo obtener el estado del comprobante: ${res.error || 'El servicio del SRI no devolvió datos.'}`, 'SRI Error', 'error');
      }
    } catch (err: any) {
      showAlert(`Error de conexión con el API: ${err.message}`, 'SRI', 'error');
    } finally {
      setSingleCheckingId(null);
    }
  };

  // Guardar corrección y opcionalmente reenviar
  const handleSaveCorrection = (updatedInvoice: Invoice, shouldResendImmediately?: boolean) => {
    if (onUpdateInvoice) {
      onUpdateInvoice(updatedInvoice);
    }
    showAlert(
      `La factura ${updatedInvoice.fullNumber} ha sido corregida exitosamente. Su estado ahora es PENDIENTE.`,
      'Documento Corregido',
      'success'
    );

    if (shouldResendImmediately) {
      setSelectedInvoiceForSriResend(updatedInvoice);
      setIsSriResendOpen(true);
    }
  };

  // Reenviar individual
  const handleOpenResend = (inv: Invoice) => {
    setSelectedInvoiceForSriResend(inv);
    setIsSriResendOpen(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ─── BANNER PRINCIPAL ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-red-500/10 text-red-600 rounded-2xl border border-red-500/20 shadow-xs">
            <RotateCcw className="w-7 h-7 stroke-[2.5] animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-950 tracking-tight">
                Bandeja de Facturas Devueltas (SRI)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
                Auditoría & Subsanación Automática
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium max-w-2xl mt-1 leading-relaxed">
              Monitoreo y corrección de facturas observadas o devueltas por el Web Service del SRI debido a inconsistencias en el documento (RUC/Cédula, fecha extemporánea, secuencial duplicado o descuadre de tarifas).
            </p>
          </div>
        </div>

        {/* Acciones del Header Conectadas al API Real */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Indicador de Conectividad con el API Java Backend */}
          <button
            type="button"
            onClick={checkApiConnection}
            title={apiMessage || 'Haz clic para verificar la conexión con el API local Spring Boot'}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
              apiStatus === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : apiStatus === 'CHECKING'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              apiStatus === 'CONNECTED'
                ? 'bg-emerald-500 animate-pulse'
                : apiStatus === 'CHECKING'
                  ? 'bg-blue-500 animate-ping'
                  : 'bg-red-500'
            }`} />
            <Server className="w-3.5 h-3.5 text-slate-600" />
            <span>
              {apiStatus === 'CONNECTED'
                ? 'API SRI: Conectada'
                : apiStatus === 'CHECKING'
                  ? 'Verificando API...'
                  : 'API SRI: Desconectada'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSyncWithSriApi}
            disabled={isSyncingWithSri}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Consulta en tiempo real al Web Service del SRI mediante el backend API para actualizar el estado oficial de tus comprobantes"
          >
            <RefreshCw className={`w-4 h-4 stroke-[2.5] ${isSyncingWithSri ? 'animate-spin' : ''}`} />
            <span>{isSyncingWithSri ? 'Sincronizando con SRI...' : 'Sincronizar con API SRI'}</span>
          </button>

          <button
            type="button"
            onClick={handleAutoDiagnoseAll}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            title="Analiza preventivamente las facturas emitidas para identificar errores de RUC, cédula, fechas o secuenciales antes de que sean devueltas por el SRI"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Diagnóstico Preventivo</span>
          </button>
        </div>
      </div>

      {/* ─── TARJETAS DE MÉTRICAS KPI ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devueltas */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Facturas Devueltas</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 font-mono">
            {devueltasList.length}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Monto afectado: <span className="font-bold text-slate-900 font-mono">{formatCurrency(totalMontoDevuelto, settings.currencySymbol)}</span>
          </div>
        </div>

        {/* Errores de RUC/Cédula */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">RUC / Cédula (Err 45)</span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-orange-600 font-mono">
            {errIdentificacionCount}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            No registrados en catastro o &gt;$50 CF
          </div>
        </div>

        {/* Errores de Fechas */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Fechas Extemporáneas</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">
            {errFechaCount}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Superiores a 72 horas o futuras
          </div>
        </div>

        {/* Secuenciales / Totales */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Secuencial / IVA 15%</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 font-mono">
            {errSecuencialCount + errTotalesCount}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {errSecuencialCount} duplicados / {errTotalesCount} descuadres
          </div>
        </div>
      </div>

      {/* ─── BARRA DE FILTROS & BÚSQUEDA ─────────────────────────── */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Input de Búsqueda */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por N° factura, cliente, RUC o código de error..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-orange-500 transition"
          />
        </div>

        {/* Filtros por Categoría de Error */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Motivo:
          </span>

          <button
            type="button"
            onClick={() => setErrorFilter('TODOS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              errorFilter === 'TODOS'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Todos ({devueltasList.length})
          </button>

          <button
            type="button"
            onClick={() => setErrorFilter('IDENTIFICACION')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              errorFilter === 'IDENTIFICACION'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            RUC / Cédula ({errIdentificacionCount})
          </button>

          <button
            type="button"
            onClick={() => setErrorFilter('FECHA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              errorFilter === 'FECHA'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Fecha Extemporánea ({errFechaCount})
          </button>

          <button
            type="button"
            onClick={() => setErrorFilter('SECUENCIAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              errorFilter === 'SECUENCIAL'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Secuencial Duplicado ({errSecuencialCount})
          </button>

          <button
            type="button"
            onClick={() => setErrorFilter('TOTALES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              errorFilter === 'TOTALES'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Descuadre IVA ({errTotalesCount})
          </button>
        </div>
      </div>

      {/* ─── TABLA DE FACTURAS DEVUELTAS ──────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-950 text-white font-black uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Comprobante / Fecha</th>
                <th className="py-3.5 px-4">Cliente / Identificación</th>
                <th className="py-3.5 px-4 text-center">Estado SRI</th>
                <th className="py-3.5 px-4">Motivo de Devolución Oficial SRI</th>
                <th className="py-3.5 px-4 text-right">Total ($)</th>
                <th className="py-3.5 px-4 text-center">Acciones de Corrección</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevueltas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        ¡No hay comprobantes devueltos en esta categoría!
                      </h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        No se detectaron facturas devueltas por el SRI con los criterios seleccionados. Todos los comprobantes emitidos están autorizados o puedes hacer clic en <strong className="text-slate-800">"Sincronizar con API SRI"</strong> para consultar el estado en tiempo real de tus comprobantes con el Web Service oficial.
                      </p>
                      <button
                        type="button"
                        onClick={handleSyncWithSriApi}
                        disabled={isSyncingWithSri}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isSyncingWithSri ? 'animate-spin' : ''}`} />
                        <span>Sincronizar con API SRI</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDevueltas.map((inv) => {
                  const diag = diagnosticsMap.get(inv.id);
                  const isIdError = diag?.campoAfectado === 'IDENTIFICACION';
                  const isDateError = diag?.campoAfectado === 'FECHA';
                  const isSecError = diag?.campoAfectado === 'SECUENCIAL';
                  const isTaxError = diag?.campoAfectado === 'TOTALES';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Comprobante / Fecha */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-slate-900 text-xs">
                          {inv.fullNumber || inv.number}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {formatFullDate(inv.createdAt)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Por: <span className="font-semibold text-slate-700">{inv.sellerName || 'Sistema'}</span>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {inv.customer?.name || 'CONSUMIDOR FINAL'}
                        </div>
                        <div className="font-mono text-[11px] font-bold text-slate-600 mt-0.5 flex items-center gap-1.5">
                          <span>{inv.customer?.idNumber || '9999999999999'}</span>
                          {inv.customer?.idType && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                              {inv.customer.idType}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estado SRI */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-500/15 text-red-700 border border-red-500/30 inline-flex items-center gap-1 animate-pulse">
                          <RotateCcw className="w-3 h-3" />
                          <span>DEVUELTA</span>
                        </span>
                        <div className="text-[9px] font-bold text-red-600 mt-1 uppercase">
                          Observación SRI
                        </div>
                      </td>

                      {/* Motivo de Devolución Oficial SRI */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            {diag?.codigoError && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isIdError 
                                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                  : isDateError
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : isSecError
                                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                      : 'bg-red-100 text-red-800 border border-red-300'
                              }`}>
                                ERROR {diag.codigoError}
                              </span>
                            )}
                            <span className="font-bold text-slate-900 text-xs">
                              {diag?.tituloError || 'Inconsistencia en Documento'}
                            </span>
                          </div>

                          {/* Mensaje Oficial */}
                          <p className="text-[11px] font-mono text-red-900 bg-red-50/70 p-2 rounded-lg border border-red-200/80 leading-relaxed font-semibold">
                            {inv.sriMensaje || diag?.motivoSri || 'Comprobante devuelto por validación de recepción SRI.'}
                          </p>

                          {/* Diagnóstico Breve */}
                          <div className="text-[10px] text-slate-500 flex items-start gap-1">
                            <span className="font-bold text-slate-700">Acción sugerida:</span>
                            <span>{diag?.solucionSugerida || 'Editar comprobante y reenviar.'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className="text-xs font-black text-slate-900">
                          {formatCurrency(inv.total, settings.currencySymbol)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Sub: {formatCurrency(inv.subtotal, settings.currencySymbol)}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                          {/* Botón Corregir */}
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceForCorrection(inv)}
                            className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer w-full sm:w-auto justify-center"
                            title="Corregir los campos erróneos del comprobante (RUC, fecha, secuencial, IVA)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Corregir</span>
                          </button>

                          {/* Botón Reenviar SRI */}
                          <button
                            type="button"
                            onClick={() => handleOpenResend(inv)}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer w-full sm:w-auto justify-center"
                            title="Reintentar firma y envío al SRI mediante el API"
                          >
                            <Send className="w-3.5 h-3.5 text-orange-400" />
                            <span>Reenviar</span>
                          </button>

                          {/* Botón Consultar SRI en Tiempo Real */}
                          {inv.sriClaveAcceso && (
                            <button
                              type="button"
                              onClick={() => handleCheckSingleInvoiceStatus(inv)}
                              disabled={singleCheckingId === inv.id}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer w-full sm:w-auto justify-center disabled:opacity-50"
                              title="Consultar en tiempo real el estado en el Web Service del SRI mediante el API"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${singleCheckingId === inv.id ? 'animate-spin text-blue-600' : 'text-blue-500'}`} />
                              <span>{singleCheckingId === inv.id ? 'Consultando...' : 'Consultar SRI'}</span>
                            </button>
                          )}

                          {/* Botón Auditoría / Detalle */}
                          <button
                            type="button"
                            onClick={() => setAuditModalInvoice({ invoice: inv, diag: diag! })}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                            title="Ver detalles de auditoría y diagnóstico del SRI"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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

      {/* ─── MODAL DE CORRECCIÓN INTELIGENTE ──────────────────────── */}
      {selectedInvoiceForCorrection && (
        <SriCorrectionModal
          isOpen={!!selectedInvoiceForCorrection}
          onClose={() => setSelectedInvoiceForCorrection(null)}
          invoice={selectedInvoiceForCorrection}
          existingInvoices={invoices}
          settings={settings}
          onSaveCorrection={handleSaveCorrection}
        />
      )}

      {/* ─── MODAL DE TRANSMISIÓN SRI (REENVÍO) ────────────────────── */}
      {isSriResendOpen && selectedInvoiceForSriResend && (
        <SriEmissionProgressModal
          isOpen={isSriResendOpen}
          onClose={() => {
            setIsSriResendOpen(false);
            setSelectedInvoiceForSriResend(null);
          }}
          invoice={selectedInvoiceForSriResend}
          settings={settings}
          onInvoiceUpdated={(updated) => {
            if (onUpdateInvoice) {
              onUpdateInvoice(updated);
            }
          }}
        />
      )}

      {/* ─── MODAL DE AUDITORÍA / DETALLE TÉCNICO SRI ──────────────── */}
      {auditModalInvoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">Ficha de Auditoría SRI</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Comprobante: {auditModalInvoice.invoice.fullNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalInvoice(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-red-50 p-4 rounded-2xl border border-red-200 space-y-2">
                <div className="flex items-center gap-2 font-black text-red-950 uppercase">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Mensaje Devuelto por Web Service SRI:</span>
                </div>
                <div className="font-mono text-red-900 bg-white p-3 rounded-xl border border-red-200 text-xs leading-relaxed font-bold">
                  {auditModalInvoice.invoice.sriMensaje || 'Sin mensaje detallado del SRI.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Código de Error:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {auditModalInvoice.diag.codigoError ? `ERROR ${auditModalInvoice.diag.codigoError}` : 'N/A'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Campo del Documento:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {auditModalInvoice.diag.campoAfectado || 'ESTRUCTURA'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Diagnóstico de la Devolución:</span>
                <p className="text-slate-800 font-medium leading-relaxed">
                  {auditModalInvoice.diag.diagnostico}
                </p>
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Acción Recomendada:</span>
                <p className="text-emerald-950 font-semibold leading-relaxed">
                  {auditModalInvoice.diag.solucionSugerida}
                </p>
              </div>

              {auditModalInvoice.invoice.sriClaveAcceso && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Clave de Acceso (49 dígitos):</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 break-all select-all block">
                    {auditModalInvoice.invoice.sriClaveAcceso}
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAuditModalInvoice(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => {
                  const inv = auditModalInvoice.invoice;
                  setAuditModalInvoice(null);
                  setSelectedInvoiceForCorrection(inv);
                }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Ir a Corregir Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

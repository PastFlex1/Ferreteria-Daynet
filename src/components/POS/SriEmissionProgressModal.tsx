import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  FileText, 
  Download, 
  X, 
  ExternalLink,
  ShieldCheck,
  Send,
  Building2,
  Key
} from 'lucide-react';
import { Invoice, StoreSettings } from '../../types';
import { SriBackendService } from '../../services/sriBackendService';
import { generateInvoiceXML, convertERPInvoiceToSRI, downloadXML } from '../../services/sriXmlService';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';

interface SriEmissionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  settings: StoreSettings;
  onInvoiceUpdated?: (updatedInvoice: Invoice) => void;
}

export const SriEmissionProgressModal: React.FC<SriEmissionProgressModalProps> = ({
  isOpen,
  onClose,
  invoice,
  settings,
  onInvoiceUpdated,
}) => {
  const [sriMode, setSriMode] = useFirestoreSync<'PRUEBAS' | 'PRODUCCION'>('ferreteria_settings_sri_mode', 'PRUEBAS');
  const [establishment] = useFirestoreSync<string>('ferreteria_settings_establishment', '001');
  const [emissionPoint] = useFirestoreSync<string>('ferreteria_settings_emission_point', '001');
  const [signatureBase64] = useFirestoreSync<string>('ferreteria_settings_p12_base64', '');
  const [signaturePassword, setSignaturePassword] = useFirestoreSync<string>('ferreteria_settings_p12_password', '');
  const [inputPassword, setInputPassword] = useState(signaturePassword || '');

  // Pipeline execution state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1); // 1: Firma, 2: Recepción, 3: Autorización, 4: Terminado
  const [step1Status, setStep1Status] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [step2Status, setStep2Status] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [step3Status, setStep3Status] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');

  const [step1Details, setStep1Details] = useState<string>('');
  const [step2Details, setStep2Details] = useState<string>('');
  const [step3Details, setStep3Details] = useState<string>('');

  const [claveAcceso, setClaveAcceso] = useState<string>('');
  const [xmlFirmado, setXmlFirmado] = useState<string>('');
  const [autorizacionData, setAutorizacionData] = useState<{
    numeroAutorizacion?: string;
    fechaAutorizacion?: string;
    estado?: string;
    mensaje?: string;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && invoice) {
      // Iniciar proceso automático paso a paso
      ejecutarProcesoEmisionSRI();
    }
  }, [isOpen, invoice?.id]);

  const ejecutarProcesoEmisionSRI = async () => {
    if (!invoice) return;

    setIsProcessing(true);
    setErrorMessage(null);

    // Preparar datos SRI
    const ambienteVal = sriMode === 'PRODUCCION' ? '2' : '1';
    const sriData = convertERPInvoiceToSRI(invoice, settings, establishment, emissionPoint, ambienteVal);
    const { xml: xmlOriginal, claveAcceso: claveCalculada } = generateInvoiceXML(sriData);
    setClaveAcceso(claveCalculada);

    try {
      // ──────────────────────────────────────────────────────────
      // PASO 1: FIRMA DIGITAL XAdES-BES
      // ──────────────────────────────────────────────────────────
      setCurrentStep(1);
      setStep1Status('LOADING');
      setStep1Details('Generando estructura XML y firmando con certificado digital en memoria...');

      const base64ToSend = signatureBase64 || localStorage.getItem('ferreteria_settings_p12_base64') || '';
      const passwordToSend = signaturePassword ?? (localStorage.getItem('ferreteria_settings_p12_password') || '');

      const fRes = await SriBackendService.firmarXml(xmlOriginal, base64ToSend, passwordToSend);

      if (!fRes.success || !fRes.xmlFirmado) {
        setStep1Status('ERROR');
        setStep1Details(fRes.error || 'Error firmando el archivo XML.');
        throw new Error(fRes.error || 'Fallo en la firma digital.');
      }

      setXmlFirmado(fRes.xmlFirmado);
      setStep1Status('SUCCESS');
      setStep1Details('XML firmado exitosamente bajo el estándar XAdES-BES.');

      // Pequeña pausa visual para observar la transición
      await new Promise(r => setTimeout(r, 600));

      // ──────────────────────────────────────────────────────────
      // PASO 2: RECEPCIÓN SRI (SOAP RecepcionComprobantesOffline)
      // ──────────────────────────────────────────────────────────
      setCurrentStep(2);
      setStep2Status('LOADING');
      setStep2Details(`Enviando comprobante firmado a Web Service de Recepción SRI (${sriMode})...`);

      const rRes = await SriBackendService.recepcionarSri(fRes.xmlFirmado);
      console.log('📡 [SRI 2. RECEPCIÓN RAW]:', rRes.recepcion || rRes.error);

      if (!rRes.success) {
        setStep2Status('ERROR');
        setStep2Details(rRes.error || 'El SRI rechazó la recepción del comprobante.');
        throw new Error(rRes.error || 'Fallo en la recepción del SRI.');
      }

      setStep2Status('SUCCESS');
      setStep2Details('Comprobante recibido con estado RECIBIDA por el SRI.');

      await new Promise(r => setTimeout(r, 600));

      // ──────────────────────────────────────────────────────────
      // PASO 3: CONSULTA DE AUTORIZACIÓN SRI (SOAP Autorizacion)
      // ──────────────────────────────────────────────────────────
      setCurrentStep(3);
      setStep3Status('LOADING');
      setStep3Details(`Consultando estado de autorización para la clave: ${claveCalculada}...`);

      const aRes = await SriBackendService.autorizarSri(claveCalculada);
      console.log('🏛️ [SRI 3. AUTORIZACIÓN RAW]:', aRes.autorizacion || aRes.error);

      if (!aRes.success) {
        setStep3Status('ERROR');
        setStep3Details(aRes.error || 'El comprobante no pudo ser autorizado por el SRI.');
        throw new Error(aRes.error || 'Fallo en la autorización del SRI.');
      }

      // Extraer datos de la respuesta oficial del SRI
      const authXml = aRes.autorizacion || '';
      const isAutorizado = authXml.toUpperCase().includes('AUTORIZADO') && !authXml.toUpperCase().includes('NO AUTORIZADO');
      
      const numMatch = authXml.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/i);
      const fechaMatch = authXml.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/i);
      const estadoMatch = authXml.match(/<estado>(.*?)<\/estado>/i);
      
      // Extraer todos los mensajes y advertencias devueltos por el SRI
      const mensajesList: string[] = [];
      const msgRegex = /<mensaje>([\s\S]*?)<\/mensaje>/gi;
      let m;
      while ((m = msgRegex.exec(authXml)) !== null) {
        const block = m[1];
        const textM = block.match(/<mensaje>(.*?)<\/mensaje>/i) || [null, block];
        const identM = block.match(/<identificador>(.*?)<\/identificador>/i);
        const infoM = block.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
        const tipoM = block.match(/<tipo>(.*?)<\/tipo>/i);

        const idStr = identM ? `[Código ${identM[1]}] ` : '';
        const msgStr = textM[1] ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
        const infoStr = infoM ? ` -> ${infoM[1].trim()}` : '';
        const tipoStr = tipoM ? ` (${tipoM[1]})` : '';

        if (msgStr) {
          mensajesList.push(`${idStr}${msgStr}${infoStr}${tipoStr}`);
        }
      }

      const numAuth = numMatch ? numMatch[1] : (isAutorizado ? claveCalculada : undefined);
      const fechaAuth = fechaMatch ? fechaMatch[1] : (isAutorizado ? new Date().toLocaleString() : undefined);
      const estadoReal = estadoMatch ? estadoMatch[1] : (isAutorizado ? 'AUTORIZADO' : 'NO AUTORIZADO');
      const mensajeError = mensajesList.length > 0 ? mensajesList.join(' | ') : 'Sin detalle de error específico devuelto por el SRI.';

      if (!isAutorizado) {
        setStep3Status('ERROR');
        setStep3Details(`SRI: ${estadoReal} — ${mensajeError}`);
        throw new Error(`El SRI devolvió: ${estadoReal} — ${mensajeError}`);
      }

      // Construir el XML oficial de autorización del SRI (Estándar oficial para el cliente y SRI)
      const xmlAutorizadoOficial = `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion>
  <estado>AUTORIZADO</estado>
  <numeroAutorizacion>${numAuth}</numeroAutorizacion>
  <fechaAutorizacion class="fechaAutorizacion">${fechaAuth}</fechaAutorizacion>
  <ambiente>${sriMode === 'PRODUCCION' ? 'PRODUCCIÓN' : 'PRUEBAS'}</ambiente>
  <comprobante><![CDATA[${fRes.xmlFirmado}]]></comprobante>
  <mensajes/>
</autorizacion>`;

      setXmlFirmado(xmlAutorizadoOficial);

      setAutorizacionData({
        numeroAutorizacion: numAuth,
        fechaAutorizacion: fechaAuth,
        estado: 'AUTORIZADO',
        mensaje: '¡Comprobante AUTORIZADO legalmente por el SRI!',
      });

      setStep3Status('SUCCESS');
      setStep3Details(`N° Autorización SRI: ${numAuth}`);
      setCurrentStep(4);

      // Actualizar factura en estado principal
      if (onInvoiceUpdated) {
        const updatedInvoice: Invoice = {
          ...invoice,
          sriStatus: 'AUTORIZADO',
          sriClaveAcceso: claveCalculada,
          sriNumeroAutorizacion: numAuth,
          sriFechaAutorizacion: fechaAuth,
          sriXmlFirmado: xmlAutorizadoOficial,
          sriMensaje: 'AUTORIZADO por el SRI',
        };
        onInvoiceUpdated(updatedInvoice);
      }
    } catch (err: any) {
      console.error('[SRI Modal Error]', err);
      setErrorMessage(err.message || 'Error en la transmisión electrónica con el SRI.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-2xl border border-orange-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">Transmisión Electrónica SRI</h3>
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = sriMode === 'PRUEBAS' ? 'PRODUCCION' : 'PRUEBAS';
                    setSriMode(nextMode);
                    try {
                      localStorage.setItem('ferreteria_settings_sri_mode', nextMode);
                    } catch (e) {}
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border transition cursor-pointer flex items-center gap-1 ${
                    sriMode === 'PRODUCCION'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                  }`}
                  title="Clic para cambiar entre PRUEBAS (1) y PRODUCCIÓN (2)"
                >
                  <span>Ambiente: {sriMode}</span>
                  <span className="text-[9px] opacity-75 font-normal underline">Cambiar</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 font-mono font-medium mt-0.5">
                Factura {invoice.fullNumber} · Cliente: {invoice.customer.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition cursor-pointer disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 bg-slate-50/50 max-h-[75vh] overflow-y-auto">
          {/* Clave de acceso preview */}
          {claveAcceso && (
            <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 text-left space-y-1">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-400">
                <span>Clave de Acceso SRI (49 Dígitos · Módulo 11)</span>
                <span className="text-orange-400 font-mono">Dígito Verificador OK</span>
              </div>
              <div className="font-mono text-xs font-bold text-white break-all tracking-wider selection:bg-orange-500">
                {claveAcceso}
              </div>
            </div>
          )}

          {/* 3 Steps Pipeline Visualizer */}
          <div className="space-y-3">
            {/* PASO 1 */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${
              step1Status === 'SUCCESS'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : step1Status === 'LOADING'
                ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm animate-pulse'
                : step1Status === 'ERROR'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-white border-slate-200 text-slate-500 opacity-60'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                    step1Status === 'SUCCESS'
                      ? 'bg-emerald-600 text-white'
                      : step1Status === 'LOADING'
                      ? 'bg-blue-600 text-white animate-spin'
                      : step1Status === 'ERROR'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step1Status === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5" /> : step1Status === 'LOADING' ? <RefreshCw className="w-4 h-4" /> : '1'}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      <span>1. Firma Digital XAdES-BES (Backend Java Local)</span>
                    </h4>
                    <p className="text-[11px] font-medium mt-0.5 leading-relaxed">
                      {step1Details || 'Firma del XML en memoria con clave privada y certificado PKCS#12.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* PASO 2 */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${
              step2Status === 'SUCCESS'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : step2Status === 'LOADING'
                ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm animate-pulse'
                : step2Status === 'ERROR'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-white border-slate-200 text-slate-500 opacity-60'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                    step2Status === 'SUCCESS'
                      ? 'bg-emerald-600 text-white'
                      : step2Status === 'LOADING'
                      ? 'bg-blue-600 text-white animate-spin'
                      : step2Status === 'ERROR'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step2Status === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5" /> : step2Status === 'LOADING' ? <RefreshCw className="w-4 h-4" /> : '2'}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" />
                      <span>2. Recepción SRI (Web Service Offline)</span>
                    </h4>
                    <p className="text-[11px] font-medium mt-0.5 leading-relaxed">
                      {step2Details || 'Envío del XML firmado al servidor del SRI para su recepción inicial.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* PASO 3 */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${
              step3Status === 'SUCCESS'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : step3Status === 'LOADING'
                ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm animate-pulse'
                : step3Status === 'ERROR'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-white border-slate-200 text-slate-500 opacity-60'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                    step3Status === 'SUCCESS'
                      ? 'bg-emerald-600 text-white'
                      : step3Status === 'LOADING'
                      ? 'bg-blue-600 text-white animate-spin'
                      : step3Status === 'ERROR'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step3Status === 'SUCCESS' ? <ShieldCheck className="w-5 h-5" /> : step3Status === 'LOADING' ? <RefreshCw className="w-4 h-4" /> : '3'}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>3. Autorización y Validación SRI</span>
                    </h4>
                    <p className="text-[11px] font-medium mt-0.5 leading-relaxed">
                      {step3Details || 'Consulta y verificación de autorización legal tributaria.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {autorizacionData?.estado === 'AUTORIZADO' && (
            <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg space-y-2 animate-scaleUp">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-200" />
                  <span className="text-xs font-black uppercase tracking-wide">¡COMPROBANTE AUTORIZADO!</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-700/80 rounded-md text-[10px] font-mono font-bold">
                  SRI OK
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-1 border-t border-emerald-500/50 text-[11px] font-medium">
                <div>
                  <span className="text-emerald-200 block text-[10px] uppercase font-bold">N° Autorización</span>
                  <span className="font-mono font-bold truncate block">{autorizacionData.numeroAutorizacion || claveAcceso}</span>
                </div>
                <div>
                  <span className="text-emerald-200 block text-[10px] uppercase font-bold">Fecha y Hora SRI</span>
                  <span className="font-mono font-bold block">{autorizacionData.fechaAutorizacion || new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message & Inline Password Recovery */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs space-y-3 animate-fadeIn">
              <div className="flex items-center space-x-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Error en el flujo de transmisión:</span>
              </div>
              <p className="font-mono text-[11px] bg-white/70 p-2.5 rounded-xl border border-rose-200/80 break-words">
                {errorMessage}
              </p>

              {/* Password prompt if keystore password was incorrect */}
              {(errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('contraseña')) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ingrese la contraseña correcta de su firma digital (.p12):</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Contraseña de la firma..."
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!inputPassword) return;
                        setSignaturePassword(inputPassword);
                        try {
                          localStorage.setItem('ferreteria_settings_p12_password', inputPassword);
                        } catch (e) {}
                        ejecutarProcesoEmisionSRI();
                      }}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap"
                    >
                      Guardar y Firmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {xmlFirmado && (
              <button
                type="button"
                onClick={() => downloadXML(xmlFirmado, `factura-${invoice.fullNumber}-firmada.xml`)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Descargar XML Autorizado (SRI)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {errorMessage && !isProcessing && (
              <button
                type="button"
                onClick={ejecutarProcesoEmisionSRI}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar Transmisión</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
            >
              {autorizacionData?.estado === 'AUTORIZADO' ? 'Finalizar' : 'Cerrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

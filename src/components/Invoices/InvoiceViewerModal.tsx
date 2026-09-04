import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  Wrench, 
  Building2, 
  FileText, 
  Share2, 
  RefreshCw,
  ShieldCheck,
  Send,
  Sparkles,
  Key
} from 'lucide-react';
import { Invoice, StoreSettings } from '../../types';
import { formatCurrency, formatFullDate, getDocumentTypeName, getPaymentMethodLabel } from '../../utils/formatters';
import { SriTotalsTable } from '../POS/SriTotalsTable';
import { calculateSriTotals } from '../../utils/sriCalculations';
import { SriEmissionProgressModal } from '../POS/SriEmissionProgressModal';
import { downloadXML, convertERPInvoiceToSRI, generateInvoiceXML, getAuthorizedXmlContent } from '../../services/sriXmlService';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

interface InvoiceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  settings: StoreSettings;
  onConvertQuoteToInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
}

export const InvoiceViewerModal: React.FC<InvoiceViewerModalProps> = ({
  isOpen,
  onClose,
  invoice,
  settings,
  onConvertQuoteToInvoice,
  onUpdateInvoice,
}) => {
  const [ticketFormat, setTicketFormat] = useState<'A4' | 'THERMAL'>('A4');
  const [isSriModalOpen, setIsSriModalOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(invoice);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [sriMode] = useFirestoreSync<'PRUEBAS' | 'PRODUCCION'>('ferreteria_settings_sri_mode', 'PRUEBAS');
  const [establishment] = useFirestoreSync<string>('ferreteria_settings_establishment', '001');
  const [emissionPoint] = useFirestoreSync<string>('ferreteria_settings_emission_point', '001');
  const barcodeRef = React.useRef<SVGSVGElement | null>(null);

  React.useEffect(() => {
    setCurrentInvoice(invoice);
  }, [invoice]);

  const claveAccesoCalculada = React.useMemo(() => {
    if (!currentInvoice) return '';
    if (currentInvoice.sriClaveAcceso && currentInvoice.sriClaveAcceso.replace(/\D/g, '').length === 49) {
      return currentInvoice.sriClaveAcceso.replace(/\D/g, '');
    }
    if (currentInvoice.sriNumeroAutorizacion && currentInvoice.sriNumeroAutorizacion.replace(/\D/g, '').length === 49) {
      return currentInvoice.sriNumeroAutorizacion.replace(/\D/g, '');
    }

    try {
      // Extraer datos del comprobante para construir la clave de acceso oficial de 49 dígitos
      const rawNumber = (currentInvoice.fullNumber || '').replace(/[^\d-]/g, '');
      const parts = rawNumber.split('-').filter(Boolean);
      const estab = parts.length >= 3 ? parts[0].padStart(3, '0').slice(-3) : (establishment || '001');
      const ptoEmi = parts.length >= 3 ? parts[1].padStart(3, '0').slice(-3) : (emissionPoint || '001');
      const secStr = parts.length >= 3 ? parts[2] : String(currentInvoice.number || '1');
      const secuencial = secStr.replace(/\D/g, '').padStart(9, '0').slice(-9);

      const d = new Date(currentInvoice.createdAt || Date.now());
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = String(d.getFullYear());
      const fechaDigitos = `${dia}${mes}${anio}`;

      const codDoc = currentInvoice.documentType === 'FACTURA' ? '01' : '04';
      const rucEmisor = (settings.taxId || '1725389454001').replace(/\D/g, '').padStart(13, '0').slice(0, 13);
      const ambCode = sriMode === 'PRODUCCION' ? '2' : '1';
      const serie = `${estab}${ptoEmi}`;
      const codNum = '12345678';
      const tipoEmi = '1';

      const base48 = `${fechaDigitos}${codDoc}${rucEmisor}${ambCode}${serie}${secuencial}${codNum}${tipoEmi}`;
      
      // Algoritmo oficial Módulo 11 del SRI (ponderación 7..2)
      let suma = 0;
      let factor = 2;
      for (let i = base48.length - 1; i >= 0; i--) {
        suma += parseInt(base48.charAt(i), 10) * factor;
        factor = factor === 7 ? 2 : factor + 1;
      }
      const residuo = suma % 11;
      const dv = 11 - residuo === 11 ? 0 : (11 - residuo === 10 ? 1 : 11 - residuo);

      return `${base48}${dv}`;
    } catch (e) {
      console.warn('Error calculando clave de acceso SRI:', e);
      return '';
    }
  }, [currentInvoice, settings, sriMode, establishment, emissionPoint]);

  React.useEffect(() => {
    if (barcodeRef.current && claveAccesoCalculada && claveAccesoCalculada.length === 49 && ticketFormat === 'A4' && isOpen) {
      try {
        JsBarcode(barcodeRef.current, claveAccesoCalculada, {
          format: 'CODE128',
          width: 1.4,
          height: 48,
          displayValue: false,
          margin: 0,
          lineColor: '#000000',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }
  }, [claveAccesoCalculada, currentInvoice, ticketFormat, isOpen]);

  if (!isOpen || !currentInvoice) return null;

  const activeInvoice = currentInvoice;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-invoice');
    if (!element) {
      window.print();
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const isA4 = ticketFormat === 'A4';
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: isA4 ? 'a4' : [80, Math.max(160, Math.round((canvas.height * 80) / canvas.width))],
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = isA4 ? 8 : 2;
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      pdf.save(`RIDE-${activeInvoice.fullNumber}.pdf`);
    } catch (err) {
      console.error('[PDF Export Error]', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleInvoiceUpdated = (updated: Invoice) => {
    setCurrentInvoice(updated);
    if (onUpdateInvoice) {
      onUpdateInvoice(updated);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
        <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] ring-1 ring-slate-900/10">
          {/* Modal Top Actions Header */}
          <div className="px-6 py-4 bg-slate-950 text-white border-b border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 no-print">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-2xl shrink-0 shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-white text-sm sm:text-base tracking-tight truncate">
                    {getDocumentTypeName(activeInvoice.documentType)} — <span className="font-mono text-orange-400">{activeInvoice.fullNumber}</span>
                  </h3>
                  {activeInvoice.documentType === 'FACTURA' && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 inline-flex items-center gap-1 ${
                      activeInvoice.sriStatus === 'AUTORIZADO'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                    }`}>
                      <ShieldCheck className="w-3 h-3" />
                      <span>{activeInvoice.sriStatus === 'AUTORIZADO' ? 'SRI AUTORIZADO' : 'SRI PENDIENTE'}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatFullDate(activeInvoice.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
              {/* Botón para Transmisión en Vivo al SRI */}
              {activeInvoice.documentType === 'FACTURA' && (
                <button
                  type="button"
                  onClick={() => setIsSriModalOpen(true)}
                  className={`px-3 py-1.5 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap ${
                    activeInvoice.sriStatus === 'AUTORIZADO'
                      ? 'bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/20 animate-pulse'
                  }`}
                >
                  {activeInvoice.sriStatus === 'AUTORIZADO' ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ver SRI</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmitir SRI</span>
                    </>
                  )}
                </button>
              )}

              {/* Format Toggle */}
              <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center shrink-0">
                <button
                  onClick={() => setTicketFormat('A4')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                    ticketFormat === 'A4' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  A4 / Factura
                </button>
                <button
                  onClick={() => setTicketFormat('THERMAL')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                    ticketFormat === 'THERMAL' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ticket 80mm
                </button>
              </div>

              {/* Descargar XML Autorizado */}
              {(activeInvoice.sriStatus === 'AUTORIZADO' || !!activeInvoice.sriNumeroAutorizacion || !!activeInvoice.sriXmlFirmado) && (
                <button
                  type="button"
                  onClick={() => {
                    const xml = getAuthorizedXmlContent(activeInvoice, settings, undefined, undefined, sriMode);
                    downloadXML(xml, `factura-${activeInvoice.fullNumber || activeInvoice.number}-autorizada.xml`);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                  title="Descargar XML oficial autorizado del SRI"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>XML Autorizado</span>
                </button>
              )}

              {/* Convert Quote Button */}
              {activeInvoice.documentType === 'COTIZACION' && onConvertQuoteToInvoice && (
                <button
                  onClick={() => onConvertQuoteToInvoice(activeInvoice)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Facturar</span>
                </button>
              )}

              {/* Descargar PDF Directo */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs transition shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                title="Generar y descargar archivo PDF del RIDE"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}</span>
              </button>

              {/* Imprimir Dialog */}
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition border border-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Abrir diálogo de impresión del navegador"
              >
                <Printer className="w-3.5 h-3.5 text-orange-400 stroke-[2.5]" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer ml-1 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

        {/* Printable Area Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-100/80">
          {ticketFormat === 'A4' ? (
            /* Official SRI Ecuador RIDE Layout */
            <div id="printable-invoice" className="bg-white text-black p-4 sm:p-6 mx-auto max-w-4xl font-sans text-xs">
              {/* TOP ROW: Emisor (Left) & SRI Info / Clave de Acceso (Right) - Diseño Idéntico al RIDE Oficial */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* Left Column: Logo & Emisor Box */}
                <div className="flex flex-col justify-between space-y-3">
                  {/* Logo Container */}
                  <div className="flex items-center justify-center min-h-[110px] max-h-[140px] pb-1">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="max-h-28 max-w-[220px] object-contain rounded-lg" />
                    ) : (
                      <div className="w-[130px] h-[130px] bg-black rounded-2xl flex flex-col items-center justify-center p-3 text-white shadow-md relative overflow-hidden border border-zinc-800 select-none">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-zinc-600 via-zinc-300 to-white flex items-center justify-center mb-1 shadow-inner">
                          <Building2 className="w-6 h-6 text-black" />
                        </div>
                        <span className="font-black text-[13px] tracking-wider text-center uppercase leading-none">
                          {settings.storeName || 'APM INOX'}
                        </span>
                        <span className="text-[7.5px] tracking-widest text-zinc-400 uppercase mt-1">
                          ACERO INOXIDABLE
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Emisor Box - high rounded corners border-black */}
                  <div className="border border-black rounded-[24px] p-6 flex-1 text-xs leading-normal flex flex-col justify-between bg-white">
                    <div>
                      <h2 className="font-bold text-[14.5px] text-black leading-snug tracking-tight">
                        {settings.legalName || 'Andrés Paul Morales Tobar'}
                      </h2>
                      <h3 className="font-bold text-[14.5px] text-black leading-snug tracking-tight mt-0.5">
                        {settings.storeName || settings.legalName || 'Apm Inox'}
                      </h3>
                    </div>

                    <div className="space-y-2 mt-2.5 text-[11.5px]">
                      <div>
                        <span className="text-black block font-normal">Dirección Matriz:</span>
                        <p className="text-zinc-900 leading-snug mt-0.5 font-normal">
                          {settings.address || 'Figueroa Oe 4-14 y 25 de Mayo (a media cuadra del Obelisco de Cotocollao)'}
                        </p>
                      </div>
                      <div>
                        <span className="text-black block font-normal">Dirección Sucursal:</span>
                        <p className="text-zinc-900 leading-snug mt-0.5 font-normal">
                          {settings.address || 'Figueroa Oe 4-14 y 25 de Mayo (a media cuadra del Obelisco de Cotocollao)'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 text-[11.5px] text-zinc-900 space-y-0.5 font-normal">
                      <div>
                        Telf: {settings.phone || '025158093 - 0992769292 - 0989411821'}
                      </div>
                      <div>
                        Email: {settings.email || 'amec.marcando.diferencia@hotmail.com'}
                      </div>
                    </div>

                    <div className="mt-2.5 text-[11.5px] space-y-1">
                      <div className="font-bold text-black">
                        OBLIGADO A LLEVAR CONTABILIDAD: {settings.accountingRequired ? 'SI' : 'NO'}
                      </div>
                      <div className="font-bold text-black uppercase">
                        CONTRIBUYENTE RÉGIMEN RIMPE
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: SRI Box with Barcode - high rounded corners border-black */}
                <div className="border border-black rounded-[24px] p-6 flex flex-col justify-between text-xs bg-white">
                  <div>
                    <div className="text-[17px] font-bold text-black tracking-tight">
                      R.U.C.: <span className="font-bold">{settings.taxId || '1725389454001'}</span>
                    </div>
                    <div className="text-[22px] font-bold text-black tracking-normal mt-3 uppercase">
                      {activeInvoice.documentType === 'FACTURA' ? 'FACTURA' : getDocumentTypeName(activeInvoice.documentType).toUpperCase()}
                    </div>
                    <div className="text-[15px] font-bold text-black mt-3 mb-4">
                      No. {activeInvoice.fullNumber || '001-100-000000285'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[12px] font-bold text-black uppercase tracking-tight">
                      NÚMERO DE AUTORIZACIÓN:
                    </div>
                    <div className="text-[11px] font-mono text-zinc-900 leading-tight mt-1 mb-4 select-all break-all tracking-normal">
                      {activeInvoice.sriNumeroAutorizacion || claveAccesoCalculada}
                    </div>
                  </div>

                  <div>
                    <div className="text-[12px] font-bold text-black uppercase tracking-tight">
                      FECHA Y HORA DE AUTORIZACIÓN:
                    </div>
                    <div className="text-[12px] text-zinc-900 mt-1 mb-4 font-normal">
                      {(() => {
                        const dateStr = activeInvoice.sriFechaAutorizacion || activeInvoice.createdAt;
                        try {
                          const d = new Date(dateStr);
                          if (!isNaN(d.getTime())) {
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            const timeStr = d.toLocaleTimeString('es-EC', { hour12: false });
                            return `${day}/${month}/${year} ${timeStr}`;
                          }
                        } catch {}
                        return dateStr;
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-[12px]">
                      <span className="font-bold text-black w-36 uppercase">AMBIENTE:</span>
                      <span className="uppercase text-zinc-900 font-normal">
                        {sriMode === 'PRODUCCION' ? 'PRODUCCIÓN' : 'PRUEBAS'}
                      </span>
                    </div>
                    <div className="flex items-center text-[12px]">
                      <span className="font-bold text-black w-36 uppercase">EMISIÓN:</span>
                      <span className="uppercase text-zinc-900 font-normal">NORMAL</span>
                    </div>
                  </div>

                  {/* Código de barras Code 128 con número de 49 dígitos centrado debajo */}
                  <div className="pt-2 w-full flex flex-col items-center">
                    <svg ref={barcodeRef} className="w-full max-w-[380px] h-12"></svg>
                    <span className="font-mono text-[10.5px] tracking-wider text-black font-medium mt-1 select-all text-center">
                      {claveAccesoCalculada}
                    </span>
                  </div>
                </div>
              </div>

              {/* CLIENT / RECEPTOR SECTION - High rounded corners matching image */}
              <div className="border border-black rounded-2xl p-5 bg-white mt-4 text-[12.5px] space-y-2">
                <div className="grid grid-cols-[250px_1fr] items-center">
                  <span className="text-black">Razón Social / Nombres y Apellidos:</span>
                  <span className="font-bold uppercase text-black">{activeInvoice.customer.name || '593IMPORTACIONES S.A.S'}</span>
                </div>
                <div className="grid grid-cols-[250px_1fr] items-center">
                  <span className="text-black">Identificación:</span>
                  <span className="font-bold text-black">{activeInvoice.customer.docNumber || '1793220725001'}</span>
                </div>
                <div className="grid grid-cols-[250px_1fr] items-center">
                  <span className="text-black">Fecha:</span>
                  <span className="font-bold text-black">{(() => {
                    const d = new Date(activeInvoice.createdAt);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                  })()}</span>
                </div>
                <div className="grid grid-cols-[250px_1fr] items-center">
                  <span className="text-black">Dirección:</span>
                  <span className="text-black">{activeInvoice.customer.address || 'Puembo'}</span>
                </div>
              </div>

              {/* PRODUCTS / DETAILS TABLE - Official SRI layout matching image */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border border-black border-collapse text-[11px] bg-white">
                  <thead>
                    <tr className="border-b border-black font-bold text-black text-center">
                      <th className="border-r border-black p-2">Cod.<br/>Principal</th>
                      <th className="border-r border-black p-2">Cod.<br/>Auxiliar</th>
                      <th className="border-r border-black p-2">Cantidad</th>
                      <th className="border-r border-black p-2 text-center">Descripción</th>
                      <th className="border-r border-black p-2">Detalle<br/>Adicional</th>
                      <th className="border-r border-black p-2">Precio<br/>Unitario</th>
                      <th className="border-r border-black p-2">Subsidio</th>
                      <th className="border-r border-black p-2">Precio sin<br/>Subsidio</th>
                      <th className="border-r border-black p-2">Descuento</th>
                      <th className="p-2">Precio<br/>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInvoice.items.map((it, idx) => {
                      const code = (it as any).productCode || (it as any).code || it.sku || String(idx + 1).padStart(4, '0');
                      const desc = it.productName || (it as any).description || (it as any).name || `Producto ${idx + 1}`;
                      const qty = it.quantity || 1;
                      const unitPrice = it.unitPrice || (it as any).price || 0;
                      const totalItem = it.total || (unitPrice * qty);

                      return (
                        <tr key={idx} className="border-b border-black text-black">
                          <td className="border-r border-black p-2 text-center">{code}</td>
                          <td className="border-r border-black p-2 text-center">{code}</td>
                          <td className="border-r border-black p-2 text-center font-normal">{qty.toFixed(2)}</td>
                          <td className="border-r border-black p-2 text-left">{desc}</td>
                          <td className="border-r border-black p-2 text-center"></td>
                          <td className="border-r border-black p-2 text-center">${unitPrice.toFixed(2)}</td>
                          <td className="border-r border-black p-2 text-center">0.00</td>
                          <td className="border-r border-black p-2 text-center">0.00</td>
                          <td className="border-r border-black p-2 text-center">0.00</td>
                          <td className="p-2 text-center">${totalItem.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* BOTTOM SECTION: Additional Info (Left) + Totals Breakdown (Right) */}
              {(() => {
                const sriBreakdown = calculateSriTotals(activeInvoice.items, settings.defaultTaxRate);
                const subtotal15 = sriBreakdown.subtotal15;
                const iva15 = sriBreakdown.iva15;
                const total = sriBreakdown.valorAPagar;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mt-4">
                    {/* Left Column: Información Adicional con Forma de Pago al final */}
                    <div className="border border-black rounded-2xl p-5 bg-white text-[12.5px] flex flex-col justify-between min-h-[350px]">
                      <div className="space-y-3">
                        <h4 className="font-bold text-[13.5px] text-black">Información Adicional</h4>
                        
                        <div className="space-y-2 pt-1 text-black">
                          <div>
                            <span>Email Cliente: </span>
                            <span>{activeInvoice.customer.email || '593importaciones.ec@gmail.com'}</span>
                          </div>
                          <div>
                            <span>Teléfono: </span>
                            <span>{activeInvoice.customer.phone || '0984524519'}</span>
                          </div>
                          <div>
                            <span>Dirección: </span>
                            <span>{activeInvoice.customer.address || 'Puembo'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 text-black flex items-center">
                        <span>Forma de Pago:</span>
                        <span className="font-bold uppercase ml-4">
                          {activeInvoice.paymentMethod === 'card'
                            ? 'TARJETA DE CRÉDITO'
                            : activeInvoice.paymentMethod === 'transfer'
                            ? 'OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO'
                            : 'SIN UTILIZACIÓN DEL SISTEMA FINANCIERO'}
                        </span>
                      </div>
                    </div>

                    {/* Right Column: SRI Totals Table */}
                    <div className="bg-white">
                      <table className="w-full text-[11.5px] border border-black border-collapse bg-white">
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">SUBTOTAL 15%</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">${subtotal15.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">SUBTOTAL 0%</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">SUBTOTAL NO OBJETO DE IVA</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">SUBTOTAL EXENTO DE IVA</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">SUBTOTAL SIN IMPUESTOS</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">${subtotal15.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">TOTAL DESCUENTO</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">ICE</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">IVA 15%</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">${iva15.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">IVA 0%</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">IRBPNR</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 pl-3 border-r border-black text-black">PROPINA</td>
                            <td className="p-1.5 pr-3 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black font-bold text-[13px]">
                            <td className="p-1.5 pl-3 border-r border-black text-black font-bold">VALOR TOTAL</td>
                            <td className="p-1.5 pr-3 text-right font-bold text-black">${total.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* 80mm Thermal Receipt Layout */
            <div id="printable-invoice" className="bg-white text-slate-900 rounded-xl p-5 shadow-xl mx-auto max-w-xs font-mono text-[11px] leading-snug border border-slate-300">
              <div className="text-center pb-3 border-b border-dashed border-slate-400 space-y-1">
                {settings.logoUrl && (
                  <div className="flex justify-center mb-1.5">
                    <img src={settings.logoUrl} alt="Logo" className="max-h-12 max-w-[140px] object-contain filter grayscale" />
                  </div>
                )}
                <h2 className="font-extrabold text-sm uppercase">{settings.storeName}</h2>
                <p className="text-[10px]">{settings.address}</p>
                <p className="text-[10px]">RUC: {settings.taxId}</p>
                <p className="text-[10px]">Tel: {settings.phone}</p>
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
                <p className="font-bold text-center">*** {getDocumentTypeName(activeInvoice.documentType).toUpperCase()} ***</p>
                <p className="font-extrabold text-center">N° {activeInvoice.fullNumber}</p>
                <p>FECHA: {formatFullDate(activeInvoice.createdAt)}</p>
                <p>CLIENTE: {activeInvoice.customer.name}</p>
                <p>DOC: {activeInvoice.customer.docType} {activeInvoice.customer.docNumber}</p>
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-2">
                {activeInvoice.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <p className="font-bold text-slate-900">{item.productName}</p>
                    <div className="flex justify-between text-[10px]">
                      <span>
                        {item.quantity} {item.unit} x {formatCurrency(item.unitPrice, settings.currencySymbol)}
                      </span>
                      <span className="font-bold">{formatCurrency(item.total, settings.currencySymbol)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {(() => {
                const thermalBreakdown = calculateSriTotals(activeInvoice.items, settings.defaultTaxRate);
                return (
                  <div className="py-2 border-b border-dashed border-slate-400 space-y-1 font-bold">
                    {thermalBreakdown.rateBreakdowns && Object.keys(thermalBreakdown.rateBreakdowns).length > 0 ? (
                      Object.entries(thermalBreakdown.rateBreakdowns)
                        .filter(([rateStr, d]) => parseFloat(rateStr) > 0 && d.base > 0)
                        .map(([rateStr, d]) => (
                          <div key={`th-sub-${rateStr}`} className="flex justify-between text-[10.5px]">
                            <span>SUBTOTAL ({rateStr}%):</span>
                            <span>{formatCurrency(d.base, settings.currencySymbol)}</span>
                          </div>
                        ))
                    ) : (
                      <div className="flex justify-between">
                        <span>SUBTOTAL:</span>
                        <span>{formatCurrency(activeInvoice.subtotal, settings.currencySymbol)}</span>
                      </div>
                    )}

                    {thermalBreakdown.subtotal0 > 0 && (
                      <div className="flex justify-between text-[10.5px]">
                        <span>SUBTOTAL 0%:</span>
                        <span>{formatCurrency(thermalBreakdown.subtotal0, settings.currencySymbol)}</span>
                      </div>
                    )}

                    {thermalBreakdown.totalDescuento > 0 && (
                      <div className="flex justify-between text-[10.5px] text-slate-600">
                        <span>DESCUENTO:</span>
                        <span>-{formatCurrency(thermalBreakdown.totalDescuento, settings.currencySymbol)}</span>
                      </div>
                    )}

                    {thermalBreakdown.rateBreakdowns && Object.keys(thermalBreakdown.rateBreakdowns).length > 0 ? (
                      Object.entries(thermalBreakdown.rateBreakdowns)
                        .filter(([rateStr, d]) => parseFloat(rateStr) > 0 && d.tax > 0)
                        .map(([rateStr, d]) => (
                          <div key={`th-iva-${rateStr}`} className="flex justify-between text-[10.5px]">
                            <span>IVA ({rateStr}%):</span>
                            <span>{formatCurrency(d.tax, settings.currencySymbol)}</span>
                          </div>
                        ))
                    ) : (
                      <div className="flex justify-between">
                        <span>IVA ({settings.defaultTaxRate}%):</span>
                        <span>{formatCurrency(activeInvoice.taxTotal, settings.currencySymbol)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm pt-1 border-t border-slate-400">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(activeInvoice.total, settings.currencySymbol)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
                <p>FORMA PAGO: {getPaymentMethodLabel(activeInvoice.paymentMethod)}</p>
                {activeInvoice.paymentReference && (
                  <p className="font-mono font-bold">N° COMPROBANTE: {activeInvoice.paymentReference}</p>
                )}
                {activeInvoice.amountTendered !== undefined && (
                  <>
                    <p>ENTREGADO: {formatCurrency(activeInvoice.amountTendered, settings.currencySymbol)}</p>
                    <p>CAMBIO: {formatCurrency(activeInvoice.changeGiven || 0, settings.currencySymbol)}</p>
                  </>
                )}
              </div>

              <div className="pt-3 text-center text-[10px] space-y-1">
                <p className="font-bold">{settings.footerNotes}</p>
                <p>¡Gracias por su compra en {settings.storeName}!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Live 3-Step SRI Emission Modal */}
    <SriEmissionProgressModal
      isOpen={isSriModalOpen}
      onClose={() => setIsSriModalOpen(false)}
      invoice={activeInvoice}
      settings={settings}
      onInvoiceUpdated={handleInvoiceUpdated}
    />
  </>
);
};

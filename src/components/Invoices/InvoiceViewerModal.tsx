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
import { downloadXML, convertERPInvoiceToSRI, generateInvoiceXML } from '../../services/sriXmlService';
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
    if (currentInvoice.sriClaveAcceso) return currentInvoice.sriClaveAcceso;
    if (currentInvoice.sriNumeroAutorizacion) return currentInvoice.sriNumeroAutorizacion;
    try {
      const ambienteVal = sriMode === 'PRODUCCION' ? '2' : '1';
      const sriData = convertERPInvoiceToSRI(currentInvoice, settings, establishment, emissionPoint, ambienteVal);
      const { claveAcceso } = generateInvoiceXML(sriData);
      return claveAcceso;
    } catch {
      return '';
    }
  }, [currentInvoice, settings, sriMode, establishment, emissionPoint]);

  React.useEffect(() => {
    if (barcodeRef.current && claveAccesoCalculada && ticketFormat === 'A4' && isOpen) {
      try {
        JsBarcode(barcodeRef.current, claveAccesoCalculada, {
          format: 'CODE128',
          width: 1.15,
          height: 38,
          displayValue: true,
          font: 'monospace',
          fontSize: 9,
          margin: 2,
          lineColor: '#000000',
        });
      } catch (err) {
        console.error('Barcode render error', err);
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
              {activeInvoice.sriXmlFirmado && (
                <button
                  type="button"
                  onClick={() => downloadXML(activeInvoice.sriXmlFirmado!, `factura-${activeInvoice.fullNumber}-autorizada.xml`)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                  title="Descargar XML oficial autorizado del SRI"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>XML</span>
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
              {/* TOP ROW: Emisor (Left) & SRI Info / Clave de Acceso (Right) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* Left Column: Logo & Emisor Box */}
                <div className="flex flex-col justify-between space-y-2">
                  {/* Logo Container */}
                  <div className="flex items-center justify-center min-h-[85px] max-h-[110px] py-1">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="max-h-24 max-w-[240px] object-contain" />
                    ) : (
                      <div className="border border-dashed border-slate-400 rounded-lg w-full max-w-[240px] h-20 flex items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-50/50">
                        SIN LOGO
                      </div>
                    )}
                  </div>

                  {/* Emisor Box - subtle rounded-xl */}
                  <div className="border border-black rounded-xl p-5 flex-1 space-y-2.5 text-xs leading-snug flex flex-col justify-between">
                    <div>
                      <h2 className="font-extrabold text-sm uppercase tracking-tight text-black">{settings.legalName || settings.storeName}</h2>
                      <h3 className="font-bold text-xs uppercase text-slate-800 mt-0.5">{settings.storeName}</h3>
                    </div>
                    <div className="space-y-1.5 pt-1 text-[11px]">
                      <div>
                        <span className="font-bold block">Dirección Matriz:</span>
                        <p className="uppercase text-[10.5px] leading-tight text-slate-900 mt-0.5">{settings.address || 'ECUADOR'}</p>
                      </div>
                      <div>
                        <span className="font-bold block">Dirección Sucursal:</span>
                        <p className="uppercase text-[10.5px] leading-tight text-slate-900 mt-0.5">{settings.address || 'ECUADOR'}</p>
                      </div>
                    </div>
                    <div className="pt-2 font-bold text-xs">
                      <span>OBLIGADO A LLEVAR CONTABILIDAD: </span>
                      <span>{settings.accountingRequired ? 'SI' : 'NO'}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: SRI Box with Barcode - subtle rounded-xl */}
                <div className="border border-black rounded-xl p-5 flex flex-col justify-between space-y-3.5 text-xs">
                  <div className="space-y-3">
                    <div className="text-base font-extrabold tracking-tight">
                      R.U.C.: <span className="font-mono">{settings.taxId || '1793221927001'}</span>
                    </div>
                    <div className="text-xl font-extrabold tracking-wider uppercase">
                      {activeInvoice.documentType === 'FACTURA' ? 'FACTURA' : getDocumentTypeName(activeInvoice.documentType).toUpperCase()}
                    </div>
                    <div className="text-sm font-bold font-mono">
                      No. {activeInvoice.fullNumber}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-xs uppercase block text-black">
                      NÚMERO DE AUTORIZACIÓN:
                    </span>
                    <span className="font-mono text-[10.5px] leading-tight block break-all text-black font-medium select-all">
                      {activeInvoice.sriNumeroAutorizacion || claveAccesoCalculada}
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold">FECHA Y HORA DE AUTORIZACIÓN:</span>
                      <span className="text-right font-medium">
                        {(() => {
                          const dateStr = activeInvoice.sriFechaAutorizacion || activeInvoice.createdAt;
                          try {
                            const d = new Date(dateStr);
                            if (!isNaN(d.getTime())) {
                              const day = d.getDate();
                              const month = d.getMonth() + 1;
                              const year = d.getFullYear();
                              const timeStr = d.toLocaleTimeString('es-EC', { hour12: false });
                              return `${day}/${month}/${year}, ${timeStr}`;
                            }
                          } catch {}
                          return dateStr;
                        })()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold">AMBIENTE:</span>
                      <span className="uppercase text-right font-medium">
                        {sriMode === 'PRODUCCION' ? 'PRODUCCIÓN' : 'PRUEBAS'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold">EMISIÓN:</span>
                      <span className="uppercase text-right font-medium">NORMAL</span>
                    </div>
                  </div>

                  {/* Code128 Barcode rendered directly without crowded headers */}
                  <div className="pt-2 flex justify-center bg-white">
                    <svg ref={barcodeRef} className="w-full max-w-[360px]"></svg>
                  </div>
                </div>
              </div>

              {/* CLIENT / RECEPTOR SECTION - Square rectangular border */}
              <div className="border border-black rounded-none p-3.5 mt-3 text-[11px] leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                  <div>
                    <span className="font-bold">Razón Social / Nombres y Apellidos: </span>
                    <span className="uppercase font-semibold">{activeInvoice.customer.name}</span>
                  </div>
                  <div>
                    <span className="font-bold">Placa / Matrícula: </span>
                    <span className="font-mono">N/A</span>
                  </div>
                  <div>
                    <span className="font-bold">Identificación: </span>
                    <span className="font-mono font-bold">{activeInvoice.customer.docNumber}</span>
                  </div>
                  <div>
                    <span className="font-bold">Guía: </span>
                    <span>N/A</span>
                  </div>
                  <div>
                    <span className="font-bold">Fecha: </span>
                    <span>{new Date(activeInvoice.createdAt).toLocaleDateString('es-EC')}</span>
                  </div>
                  <div>
                    <span className="font-bold">Dirección: </span>
                    <span className="uppercase">{activeInvoice.customer.address || 'S/N'}</span>
                  </div>
                </div>
              </div>

              {/* PRODUCTS / DETAILS TABLE - Square rectangular border */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-center text-[10px] border border-black border-collapse rounded-none">
                  <thead>
                    <tr className="border-b border-black bg-slate-50 font-bold">
                      <th className="border-r border-black p-1.5">Cod. Principal</th>
                      <th className="border-r border-black p-1.5">Cod. Auxiliar</th>
                      <th className="border-r border-black p-1.5">Cantidad</th>
                      <th className="border-r border-black p-1.5 text-left">Descripción</th>
                      <th className="border-r border-black p-1.5">Detalle Adicional</th>
                      <th className="border-r border-black p-1.5">Precio Unitario</th>
                      <th className="border-r border-black p-1.5">Subsidio</th>
                      <th className="border-r border-black p-1.5">Precio sin Subsidio</th>
                      <th className="border-r border-black p-1.5">Descuento</th>
                      <th className="p-1.5">Precio Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInvoice.items.map((item, idx) => {
                      const discountAmount = item.discountPercent > 0 ? (item.unitPrice * item.quantity * item.discountPercent) / 100 : 0;
                      const itemTaxRate = typeof item.taxRate === 'number'
                        ? item.taxRate
                        : ('product' in item && (item as any).product && typeof (item as any).product.taxRate === 'number')
                        ? (item as any).product.taxRate
                        : (item.taxAmount > 0 ? settings.defaultTaxRate : 0);

                      return (
                        <tr key={idx} className="border-b border-black">
                          <td className="border-r border-black p-1.5 font-mono">{item.sku || '0101'}</td>
                          <td className="border-r border-black p-1.5 font-mono">{item.sku || '0101'}</td>
                          <td className="border-r border-black p-1.5 font-bold font-mono">{item.quantity.toFixed(2)}</td>
                          <td className="border-r border-black p-1.5 text-left uppercase font-semibold">{item.productName}</td>
                          <td className="border-r border-black p-1.5 text-center uppercase font-mono text-[9.5px]">
                            {item.unit && <span>{item.unit} • </span>}
                            <span className="font-bold">IVA {itemTaxRate}%</span>
                          </td>
                          <td className="border-r border-black p-1.5 font-mono">${item.unitPrice.toFixed(2)}</td>
                          <td className="border-r border-black p-1.5 font-mono">0.00</td>
                          <td className="border-r border-black p-1.5 font-mono">0.00</td>
                          <td className="border-r border-black p-1.5 font-mono">${discountAmount.toFixed(2)}</td>
                          <td className="p-1.5 font-mono font-bold">${item.total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* BOTTOM SECTION: Additional Info & Payments (Left) + Totals Breakdown (Right) */}
              {(() => {
                const sriBreakdown = calculateSriTotals(activeInvoice.items, settings.defaultTaxRate);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mt-3">
                    {/* Left Column: Info Adicional & Forma de Pago */}
                    <div className="space-y-3">
                      {/* Información Adicional Box - Square rectangular border */}
                      <div className="border border-black rounded-none p-3 text-[10.5px] leading-relaxed">
                        <div className="font-bold border-b border-black pb-1 mb-2 text-center uppercase tracking-wider">
                          Información Adicional
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="font-bold">email: </span>
                            <span className="font-mono">{activeInvoice.customer.email || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="font-bold">telefono: </span>
                            <span className="font-mono">{activeInvoice.customer.phone || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="font-bold">direccion: </span>
                            <span className="uppercase">{activeInvoice.customer.address || 'N/A'}</span>
                          </div>
                          {activeInvoice.notes && (
                            <div>
                              <span className="font-bold">observaciones: </span>
                              <span>{activeInvoice.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Forma de Pago Table - Square rectangular border */}
                      <div className="border border-black rounded-none overflow-hidden text-[10.5px]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-black bg-slate-50 font-bold">
                              <th className="p-1.5 border-r border-black">Forma de pago</th>
                              <th className="p-1.5 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="p-1.5 border-r border-black uppercase">
                                {activeInvoice.paymentMethod === 'EFECTIVO'
                                  ? '01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO'
                                  : activeInvoice.paymentMethod === 'TARJETA_DEBITO'
                                  ? '16 - TARJETA DE DÉBITO'
                                  : activeInvoice.paymentMethod === 'TARJETA_CREDITO'
                                  ? '19 - TARJETA DE CRÉDITO'
                                  : activeInvoice.paymentMethod === 'TRANSFERENCIA'
                                  ? '20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO'
                                  : getPaymentMethodLabel(activeInvoice.paymentMethod)}
                                {activeInvoice.paymentReference && (
                                  <span className="block text-[9px] font-mono text-slate-700 mt-0.5 normal-case font-bold">
                                    Ref / Comprobante: {activeInvoice.paymentReference}
                                  </span>
                                )}
                              </td>
                              <td className="p-1.5 text-right font-mono font-bold">${activeInvoice.total.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Column: SRI Totals Table */}
                    <div className="space-y-2">
                      <table className="w-full text-[10.5px] border border-black border-collapse">
                        <tbody>
                          {/* Subtotales gravados por cada tarifa presente */}
                          {sriBreakdown.rateBreakdowns && Object.keys(sriBreakdown.rateBreakdowns).length > 0 ? (
                            Object.entries(sriBreakdown.rateBreakdowns)
                              .filter(([rateStr]) => parseFloat(rateStr) > 0)
                              .map(([rateStr, data]) => (
                                <tr key={`subtotal-${rateStr}`} className="border-b border-black">
                                  <td className="p-1.5 border-r border-black font-bold">SUBTOTAL {rateStr}%</td>
                                  <td className="p-1.5 text-right font-mono font-bold">${data.base.toFixed(2)}</td>
                                </tr>
                              ))
                          ) : (
                            <tr className="border-b border-black">
                              <td className="p-1.5 border-r border-black font-bold">SUBTOTAL {settings.defaultTaxRate}%</td>
                              <td className="p-1.5 text-right font-mono font-bold">${sriBreakdown.subtotal15.toFixed(2)}</td>
                            </tr>
                          )}

                          <tr className="border-b border-black">
                            <td className="p-1.5 border-r border-black font-bold">SUBTOTAL 0%</td>
                            <td className="p-1.5 text-right font-mono font-bold">${sriBreakdown.subtotal0.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 border-r border-black font-bold">SUBTOTAL NO OBJETO DE IVA</td>
                            <td className="p-1.5 text-right font-mono">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 border-r border-black font-bold">SUBTOTAL EXENTO DE IVA</td>
                            <td className="p-1.5 text-right font-mono">$0.00</td>
                          </tr>
                          <tr className="border-b border-black bg-slate-50/50">
                            <td className="p-1.5 border-r border-black font-bold">SUBTOTAL SIN IMPUESTOS</td>
                            <td className="p-1.5 text-right font-mono font-bold">${sriBreakdown.subtotalSinImpuestos.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 border-r border-black font-bold">TOTAL DESCUENTO</td>
                            <td className="p-1.5 text-right font-mono">${sriBreakdown.totalDescuento.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 border-r border-black font-bold">ICE</td>
                            <td className="p-1.5 text-right font-mono">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 border-r border-black font-bold">IRBPNR</td>
                            <td className="p-1.5 text-right font-mono">$0.00</td>
                          </tr>

                          {/* IVA por cada tarifa presente */}
                          {sriBreakdown.rateBreakdowns && Object.keys(sriBreakdown.rateBreakdowns).length > 0 ? (
                            Object.entries(sriBreakdown.rateBreakdowns)
                              .filter(([rateStr]) => parseFloat(rateStr) > 0)
                              .map(([rateStr, data]) => (
                                <tr key={`iva-${rateStr}`} className="border-b border-black bg-orange-50/20">
                                  <td className="p-1.5 border-r border-black font-bold">IVA {rateStr}%</td>
                                  <td className="p-1.5 text-right font-mono font-bold text-slate-950">${data.tax.toFixed(2)}</td>
                                </tr>
                              ))
                          ) : (
                            <tr className="border-b border-black bg-orange-50/20">
                              <td className="p-1.5 border-r border-black font-bold">IVA {settings.defaultTaxRate}%</td>
                              <td className="p-1.5 text-right font-mono font-bold text-slate-950">${(sriBreakdown.iva15 || activeInvoice.taxTotal || 0).toFixed(2)}</td>
                            </tr>
                          )}

                          <tr className="border-b border-black">
                            <td className="p-1.5 border-r border-black font-bold">PROPINA</td>
                            <td className="p-1.5 text-right font-mono">${sriBreakdown.propina10Amount.toFixed(2)}</td>
                          </tr>
                          <tr className="bg-slate-100 border-b border-black font-black">
                            <td className="p-2 border-r border-black text-xs">VALOR TOTAL</td>
                            <td className="p-2 text-right font-mono text-sm font-black">${activeInvoice.total.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Subsidios Table */}
                      <table className="w-full text-[10px] border border-black border-collapse">
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="p-1 border-r border-black font-bold">VALOR TOTAL SIN SUBSIDIO</td>
                            <td className="p-1 text-right font-mono">0.00</td>
                          </tr>
                          <tr>
                            <td className="p-1 border-r border-black font-bold">AHORRO POR SUBSIDIO:</td>
                            <td className="p-1 text-right font-mono">0.00</td>
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
                <p className="text-[10px]">RFC/RUC: {settings.taxId}</p>
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

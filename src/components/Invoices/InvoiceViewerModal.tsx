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
  Key, 
  AlertCircle,
  CreditCard,
  Clock
} from 'lucide-react';
import { Invoice, StoreSettings, CreditNoteData } from '../../types';
import { formatCurrency, formatFullDate, getDocumentTypeName, getPaymentMethodLabel } from '../../utils/formatters';
import { SriTotalsTable } from '../POS/SriTotalsTable';
import { calculateSriTotals } from '../../utils/sriCalculations';
import { SriEmissionProgressModal } from '../POS/SriEmissionProgressModal';
import { CreditNoteViewerModal } from '../Sales/CreditNoteViewerModal';
import { downloadXML, convertERPInvoiceToSRI, generateInvoiceXML, getAuthorizedXmlContent } from '../../services/sriXmlService';
import { SriBackendService } from '../../services/sriBackendService';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { useModal } from '../../context/ModalContext';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface InvoiceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  settings: StoreSettings;
  onConvertQuoteToInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onStockAdjust?: (productId: string, adjustmentQty: number) => void;
  onOpenCreditNote?: (invoice: Invoice) => void;
}

export const InvoiceViewerModal: React.FC<InvoiceViewerModalProps> = ({
  isOpen,
  onClose,
  invoice,
  settings,
  onConvertQuoteToInvoice,
  onUpdateInvoice,
  onStockAdjust,
  onOpenCreditNote,
}) => {
  const { showAlert, showToast } = useModal();
  const [isAnularModalOpen, setIsAnularModalOpen] = useState(false);
  const [anularReason, setAnularReason] = useState('Anulación total de la factura');
  const [anularRestoreStock, setAnularRestoreStock] = useState(true);
  const [creditNotes, setCreditNotes] = useFirestoreSync<CreditNoteData[]>('ferreteria_credit_notes', []);
  const [secCreditNote, setSecCreditNote] = useFirestoreSync<string>('ferreteria_settings_sec_credit_note', '000000001');
  const [viewingCreditNote, setViewingCreditNote] = useState<CreditNoteData | null>(null);
  const [ticketFormat, setTicketFormat] = useState<'A4' | 'THERMAL'>('A4');
  const [isSriModalOpen, setIsSriModalOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(invoice);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isAnulando, setIsAnulando] = useState(false);
  const [anularStepText, setAnularStepText] = useState<string>('');

  const [sriMode] = useFirestoreSync<'PRUEBAS' | 'PRODUCCION'>('ferreteria_settings_sri_mode', 'PRUEBAS');
  const [establishment] = useFirestoreSync<string>('ferreteria_settings_establishment', '001');
  const [emissionPoint] = useFirestoreSync<string>('ferreteria_settings_emission_point', '001');
  const [signatureBase64] = useFirestoreSync<string>('ferreteria_settings_p12_base64', '');
  const [signaturePassword] = useFirestoreSync<string>('ferreteria_settings_p12_password', '');
  const barcodeRef = React.useRef<SVGSVGElement | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

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

  React.useEffect(() => {
    if (claveAccesoCalculada && claveAccesoCalculada.length === 49 && isOpen) {
      QRCode.toDataURL(claveAccesoCalculada, {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setQrCodeDataUrl(url);
        })
        .catch((err) => {
          console.error('Error generating SRI QR code:', err);
        });
    } else {
      setQrCodeDataUrl('');
    }
  }, [claveAccesoCalculada, isOpen]);

  const activeInvoice = currentInvoice;

  const hasExistingCN = React.useMemo(() => {
    if (!activeInvoice) return false;
    return (creditNotes || []).some(
      (cn) =>
        (activeInvoice.creditNoteRef && cn.id === activeInvoice.creditNoteRef) ||
        cn.invoiceRef === activeInvoice.fullNumber ||
        cn.invoiceId === activeInvoice.id ||
        (activeInvoice.fullNumber && cn.invoiceRef && cn.invoiceRef.endsWith(activeInvoice.fullNumber))
    );
  }, [activeInvoice, creditNotes]);

  const isAnuladaOrHasCN = React.useMemo(() => {
    if (!activeInvoice) return false;
    return activeInvoice.paymentStatus === 'ANULADA' || activeInvoice.sriStatus === 'ANULADO' || hasExistingCN;
  }, [activeInvoice, hasExistingCN]);

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
      pdf.save(`RIDE-${activeInvoice?.fullNumber || 'comprobante'}.pdf`);
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

  const handleConfirmAnular = async () => {
    if (!activeInvoice) return;
    if (isAnulando) return;

    // Verificar si ya existe Nota de Crédito para esta factura
    const existingCN = (creditNotes || []).find(
      (cn) =>
        (activeInvoice.creditNoteRef && cn.id === activeInvoice.creditNoteRef) ||
        cn.invoiceRef === activeInvoice.fullNumber ||
        cn.invoiceId === activeInvoice.id ||
        (activeInvoice.fullNumber && cn.invoiceRef && cn.invoiceRef.endsWith(activeInvoice.fullNumber))
    );

    if (existingCN) {
      showToast(`Esta factura ya tiene la Nota de Crédito ${existingCN.id} asociada.`, 'info');
      setIsAnularModalOpen(false);
      setViewingCreditNote(existingCN);
      return;
    }

    if (activeInvoice.paymentStatus === 'ANULADA' || activeInvoice.sriStatus === 'ANULADO') {
      showToast('Esta factura ya se encuentra anulada en el sistema.', 'warning');
      setIsAnularModalOpen(false);
      return;
    }

    setIsAnulando(true);
    try {
      const now = new Date();
      const currentSecNum = parseInt(secCreditNote || '1', 10);
      const formattedSec = String(currentSecNum).padStart(9, '0');
      const estab = establishment ? establishment.padStart(3, '0').slice(-3) : '001';
      const ptoEmi = emissionPoint ? emissionPoint.padStart(3, '0').slice(-3) : '001';
      const creditNoteId = `${estab}-${ptoEmi}-${formattedSec}`;

      // Clave de acceso oficial para Nota de Crédito (Tipo de Comprobante 04)
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear());
      const dateStr = `${day}${month}${year}`;
      const ruc = (settings.taxId || '1725389454001').replace(/\D/g, '').padStart(13, '0').slice(0, 13);
      const ambCode = sriMode === 'PRODUCCION' ? '2' : '1';
      const serie = `${estab}${ptoEmi}`;
      const secuencial = formattedSec;
      const codNum = '12345678';
      const tipoEmi = '1';

      const baseKey = `${dateStr}04${ruc}${ambCode}${serie}${secuencial}${codNum}${tipoEmi}`;
      let factor = 2;
      let sum = 0;
      for (let i = baseKey.length - 1; i >= 0; i--) {
        sum += parseInt(baseKey.charAt(i), 10) * factor;
        factor = factor === 7 ? 2 : factor + 1;
      }
      const rem = sum % 11;
      const dv = rem === 0 ? 0 : rem === 1 ? 1 : 11 - rem;
      const claveAcceso = `${baseKey}${dv}`;

      const totalAmount = activeInvoice.total || 0;
      const subtotal = activeInvoice.subtotal ?? (totalAmount > 0 ? parseFloat((totalAmount / 1.15).toFixed(2)) : 0);
      const tax = activeInvoice.taxTotal ?? parseFloat((totalAmount - subtotal).toFixed(2));

      const newCreditNote: CreditNoteData = {
        id: creditNoteId,
        invoiceRef: activeInvoice.fullNumber || activeInvoice.id,
        invoiceId: activeInvoice.id,
        invoiceDate: activeInvoice.createdAt,
        customer: activeInvoice.customer?.name || 'Consumidor Final',
        customerRuc: activeInvoice.customer?.docNumber || '9999999999999',
        customerAddress: activeInvoice.customer?.address || 'Matriz',
        customerEmail: activeInvoice.customer?.email || '',
        customerPhone: activeInvoice.customer?.phone || '',
        reason: anularReason,
        amount: totalAmount,
        subtotal,
        tax,
        items: activeInvoice.items,
        date: now.toISOString(),
        status: 'AUTORIZADO',
        establishment: estab,
        emissionPoint: ptoEmi,
        secNumber: formattedSec,
        claveAcceso,
        numeroAutorizacion: claveAcceso,
        fechaAutorizacion: now.toISOString(),
      };

      const isConsumidorFinal =
        (activeInvoice.customer?.docNumber || '').trim() === '9999999999999' ||
        (activeInvoice.customer?.docNumber || '').trim() === '9999999999' ||
        (activeInvoice.customer?.name || '').toUpperCase().includes('CONSUMIDOR FINAL') ||
        (activeInvoice.customer?.name || '').toUpperCase().includes('PUBLICO GENERAL');

      if (isConsumidorFinal) {
        newCreditNote.status = 'COMPROBANTE_INTERNO';
        showToast(
          `Factura a Consumidor Final anulada internamente y stock restituido al Kardex (según Res. SRI NAC-DGERCGC25-00000017 no se emite N/C electrónica).`,
          'info'
        );
      } else {
        // 1. TRANSMISIÓN REAL AL BACKEND SPRING BOOT (:8080)
        // Firma XAdES-BES (/api/sri/firmar) -> Recepción SRI (/api/sri/recepcion) -> Autorización (/api/sri/autorizacion)
        setAnularStepText('Transmitiendo Nota de Crédito al backend SRI (:8080)...');
        try {
          const certBase64 = signatureBase64 || localStorage.getItem('ferreteria_settings_p12_base64') || undefined;
          const pass = signaturePassword || localStorage.getItem('ferreteria_settings_p12_password') || undefined;

          setAnularStepText('Firmando y enviando Nota de Crédito al SRI...');
          const sriRes = await SriBackendService.emitirNotaCreditoCompleta(
            newCreditNote,
            settings,
            activeInvoice.createdAt,
            estab,
            ptoEmi,
            (sriMode === 'PRODUCCION' ? '2' : '1'),
            certBase64,
            pass
          );

          if (sriRes) {
            if (sriRes.nuevoId) {
              newCreditNote.id = sriRes.nuevoId;
              newCreditNote.secNumber = sriRes.nuevoSecuencial;
              newCreditNote.claveAcceso = sriRes.claveAcceso;
            }
            newCreditNote.status = sriRes.estado || 'PENDIENTE';
            if (sriRes.numeroAutorizacion) {
              newCreditNote.numeroAutorizacion = sriRes.numeroAutorizacion;
            }
            if (sriRes.fechaAutorizacion) {
              newCreditNote.fechaAutorizacion = sriRes.fechaAutorizacion;
            }
            if (sriRes.xmlFirmado) {
              (newCreditNote as any).sriXmlFirmado = sriRes.xmlFirmado;
            }

            if (sriRes.estado === 'AUTORIZADO') {
              showToast(`Nota de Crédito ${newCreditNote.id} AUTORIZADA legalmente por el SRI`, 'success');
            } else if (sriRes.estado === 'DEVUELTA') {
              showToast(`SRI DEVUELTA: ${sriRes.mensaje || 'Comprobante devuelto'}`, 'warning');
            } else if (sriRes.mensaje) {
              showToast(sriRes.mensaje, 'info');
            }
          }
        } catch (apiErr: any) {
          console.warn('Advertencia en comunicación con API SRI:', apiErr);
        }

        // 2. Si el backend implementa endpoint /api/sri/anular, notificarlo también
        if (claveAccesoCalculada) {
          try {
            await SriBackendService.anularFactura(claveAccesoCalculada, activeInvoice.customer?.email);
          } catch (_) {}
        }
      }

      // 3. Reintegrar stock a inventario si está seleccionado
      if (anularRestoreStock && onStockAdjust && activeInvoice.items) {
        activeInvoice.items.forEach((item) => {
          if (item.productId && item.quantity > 0) {
            onStockAdjust(item.productId, item.quantity);
          }
        });
      }

      // 3. Registrar la Nota de Crédito e incrementar el secuencial
      setCreditNotes((prev) => [newCreditNote, ...(prev || [])]);
      const nextSecNumberVal = parseInt(newCreditNote.secNumber || String(currentSecNum), 10) + 1;
      setSecCreditNote(String(nextSecNumberVal).padStart(9, '0'));

      // 4. Actualizar factura a ANULADA vinculando la Nota de Crédito
      const finalCreditNoteId = newCreditNote.id;
      const updated: Invoice = {
        ...activeInvoice,
        paymentStatus: 'ANULADA',
        sriStatus: 'ANULADO',
        creditNoteRef: finalCreditNoteId,
        notes: activeInvoice.notes
          ? `${activeInvoice.notes} | N/C ${finalCreditNoteId}: ${anularReason}`
          : `N/C ${finalCreditNoteId}: ${anularReason}`,
        cancelledAt: now.toISOString(),
        cancellationReason: anularReason,
      };

      setCurrentInvoice(updated);
      if (onUpdateInvoice) {
        onUpdateInvoice(updated);
      }

      setIsAnularModalOpen(false);

      showToast(`Factura anulada exitosamente con Nota de Crédito ${finalCreditNoteId}.`, 'success');
      // Abrir inmediatamente el RIDE de la Nota de Crédito
      setViewingCreditNote(newCreditNote);
    } catch (error: any) {
      showAlert(`Error al anular la factura: ${error.message || error}`, 'Error', 'error');
    } finally {
      setIsAnulando(false);
    }
  };

  const handleViewCreditNoteForInvoice = () => {
    if (!activeInvoice) return;
    const ref = activeInvoice.creditNoteRef;
    const found = creditNotes.find(
      (cn) =>
        (ref && cn.id === ref) ||
        cn.invoiceRef === activeInvoice.fullNumber ||
        cn.invoiceId === activeInvoice.id
    );
    if (found) {
      setViewingCreditNote(found);
    } else {
      const estab = establishment || '001';
      const ptoEmi = emissionPoint || '001';
      const syntheticNC: CreditNoteData = {
        id: ref || `${estab}-${ptoEmi}-000000001`,
        invoiceRef: activeInvoice.fullNumber,
        invoiceId: activeInvoice.id,
        invoiceDate: activeInvoice.createdAt,
        customer: activeInvoice.customer?.name || 'Consumidor Final',
        customerRuc: activeInvoice.customer?.docNumber || '9999999999999',
        customerAddress: activeInvoice.customer?.address || 'Matriz',
        customerEmail: activeInvoice.customer?.email || '',
        customerPhone: activeInvoice.customer?.phone || '',
        reason: activeInvoice.cancellationReason || 'Anulación total de la factura',
        amount: activeInvoice.total,
        subtotal: activeInvoice.subtotal,
        tax: activeInvoice.taxTotal,
        items: activeInvoice.items,
        date: activeInvoice.cancelledAt || activeInvoice.createdAt,
        status: 'AUTORIZADO',
        claveAcceso: activeInvoice.sriClaveAcceso || claveAccesoCalculada,
      };
      setViewingCreditNote(syntheticNC);
    }
  };

  if (!isOpen || !activeInvoice) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
        <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] ring-1 ring-slate-900/10">
          {/* Modal Top Actions Header (Clean 2-Tier Layout) */}
          <div className="bg-slate-950 text-white border-b border-slate-800 no-print">
            {/* Level 1: Document Identity, Status Badge & Format Toggle */}
            <div className="px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/60">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-2xl shrink-0 shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-black text-white text-base tracking-tight truncate">
                      {getDocumentTypeName(activeInvoice.documentType)} —{' '}
                      <span className="font-mono text-orange-400">{activeInvoice.fullNumber}</span>
                    </h3>
                    {activeInvoice.documentType === 'FACTURA' && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 inline-flex items-center gap-1 ${
                          isAnuladaOrHasCN
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : activeInvoice.sriStatus === 'AUTORIZADO'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : activeInvoice.sriStatus === 'DEVUELTA'
                            ? 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                        }`}
                      >
                        {isAnuladaOrHasCN ? (
                          <>
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            <span>SRI ANULADO</span>
                          </>
                        ) : activeInvoice.sriStatus === 'AUTORIZADO' ? (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>SRI AUTORIZADO</span>
                          </>
                        ) : activeInvoice.sriStatus === 'DEVUELTA' ? (
                          <>
                            <AlertCircle className="w-3 h-3 text-red-400" />
                            <span>SRI DEVUELTA</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>SRI PENDIENTE</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                    {formatFullDate(activeInvoice.createdAt)}
                  </p>
                </div>
              </div>

              {/* Top-Right: Format Switch & Close Button */}
              <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                {/* Format Toggle */}
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center shrink-0">
                  <button
                    onClick={() => setTicketFormat('A4')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                      ticketFormat === 'A4'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    A4 / Factura
                  </button>
                  <button
                    onClick={() => setTicketFormat('THERMAL')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                      ticketFormat === 'THERMAL'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ticket 80mm
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title="Cerrar visor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Level 2: Dedicated Actions Toolbar */}
            <div className="px-6 py-2 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2">
              {/* Left Action Group: SRI & Operational Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Botón para Transmisión en Vivo al SRI / Ver SRI (Solo facturas activas, no anuladas) */}
                {activeInvoice.documentType === 'FACTURA' && !isAnuladaOrHasCN && (
                  <button
                    type="button"
                    onClick={() => setIsSriModalOpen(true)}
                    className={`px-3 py-1.5 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap ${
                      activeInvoice.sriStatus === 'AUTORIZADO'
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30'
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

                {/* Descargar XML Autorizado */}
                {(activeInvoice.sriStatus === 'AUTORIZADO' ||
                  !!activeInvoice.sriNumeroAutorizacion ||
                  !!activeInvoice.sriXmlFirmado) && (
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

                {/* Acción Unificada: Anular (Nota de Crédito) */}
                {activeInvoice.documentType !== 'COTIZACION' && !isAnuladaOrHasCN && (
                  <button
                    type="button"
                    onClick={() => setIsAnularModalOpen(true)}
                    disabled={isAnulando}
                    className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-50"
                    title="Anular comprobante mediante emisión de Nota de Crédito y devolución de existencias"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                    <span>Anular (Nota de Crédito)</span>
                  </button>
                )}

                {/* Si ya está Anulada o tiene Nota de Crédito: Badge y Botón para Ver Nota de Crédito */}
                {isAnuladaOrHasCN && (
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/40 font-black rounded-xl text-xs inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>{activeInvoice.paymentStatus === 'ANULADA' ? 'ANULADA' : 'CON NOTA DE CRÉDITO'} {activeInvoice.creditNoteRef ? `(N/C: ${activeInvoice.creditNoteRef})` : ''}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleViewCreditNoteForInvoice}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                      title="Ver el comprobante RIDE de la Nota de Crédito emitida"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                      <span>Ver Nota de Crédito</span>
                    </button>
                  </div>
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
              </div>

              {/* Right Action Group: Export & Print */}
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          </div>

        {/* Printable Area Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-100/80">
          {activeInvoice.sriStatus === 'DEVUELTA' && (
            <div className="max-w-4xl mx-auto mb-5 bg-red-50 border border-red-200 rounded-2xl p-4 shadow-xs flex items-start gap-3.5">
              <div className="p-2 bg-red-100 text-red-700 rounded-xl shrink-0">
                <AlertCircle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="text-xs space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-red-950 uppercase tracking-wide">
                    Comprobante Devuelto por el SRI (Inconsistencia en el Documento)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-200 text-red-900">
                    DEVUELTA
                  </span>
                </div>
                <div className="font-mono text-red-900 bg-white/90 p-2.5 rounded-xl border border-red-200 font-bold text-[11px] leading-relaxed">
                  {activeInvoice.sriMensaje || 'El SRI devolvió el comprobante para su subsanación y corrección de datos.'}
                </div>
                <p className="text-red-700 font-medium text-[11px] mt-1">
                  Nota: Puedes corregir este comprobante en la sección <strong className="text-red-950">Ventas &gt; Devueltas (SRI)</strong> o pulsar "Transmitir SRI" para reintentar la emisión.
                </p>
              </div>
            </div>
          )}

          {/* Dynamic Print Paper Styling (A4 vs 80mm POS Thermal Roll) */}
          <style>{`
            @media print {
              ${
                ticketFormat === 'THERMAL'
                  ? `
                @page {
                  size: 80mm auto !important;
                  margin: 0 !important;
                }
                body, html {
                  width: 80mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                #printable-invoice {
                  width: 76mm !important;
                  max-width: 76mm !important;
                  min-width: 76mm !important;
                  margin: 0 auto !important;
                  padding: 2mm 1.5mm !important;
                  box-shadow: none !important;
                  border: none !important;
                  font-size: 10.5px !important;
                }
              `
                  : `
                @page {
                  size: A4 portrait !important;
                  margin: 6mm !important;
                }
                #printable-invoice {
                  width: 100% !important;
                  max-width: 100% !important;
                  padding: 0 !important;
                  margin: 0 auto !important;
                  box-shadow: none !important;
                  border: none !important;
                }
              `
              }
            }
          `}</style>

          {ticketFormat === 'A4' ? (
            /* Official SRI Ecuador RIDE Layout */
            <div id="printable-invoice" className="ride-a4 bg-white text-black p-3 sm:p-5 mx-auto max-w-[820px] font-sans text-xs">
              {/* TOP ROW: Emisor (Left) & SRI Info / Clave de Acceso (Right) - Diseño Idéntico al RIDE Oficial en 2 Columnas */}
              <div className="grid grid-cols-2 gap-3 items-stretch" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {/* Left Column: Logo & Emisor Box */}
                <div className="flex flex-col justify-between space-y-2">
                  {/* Logo Container */}
                  <div className="flex items-center justify-center min-h-[60px] max-h-[90px] pb-1">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="max-h-20 max-w-[200px] object-contain rounded-lg" />
                    ) : (
                      <div className="w-[100px] h-[75px] bg-black rounded-xl flex flex-col items-center justify-center p-2 text-white shadow-xs relative overflow-hidden border border-zinc-800 select-none">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-zinc-600 via-zinc-300 to-white flex items-center justify-center mb-0.5 shadow-inner">
                          <Building2 className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-black text-[10px] tracking-wider text-center uppercase leading-none">
                          {settings.storeName || 'FERRETERÍA'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Emisor Box - high rounded corners border-black */}
                  <div className="border border-black rounded-2xl p-3.5 flex-1 text-[10.5px] leading-tight flex flex-col justify-between bg-white">
                    <div>
                      <h2 className="font-bold text-[13px] text-black leading-snug tracking-tight">
                        {settings.legalName || 'JHON ANDRES CRUZ SANCHEZ'}
                      </h2>
                      <h3 className="font-bold text-[12.5px] text-black leading-snug tracking-tight mt-0.5">
                        {settings.storeName || settings.legalName || 'ALDAC FERRETERÍA'}
                      </h3>
                    </div>

                    <div className="space-y-1.5 mt-2 text-[10px]">
                      <div>
                        <span className="text-black block font-normal">Dirección Matriz:</span>
                        <p className="text-zinc-900 leading-snug mt-0.5 font-normal">
                          {settings.address || 'Av. Guayaquil Diagonal al TIA'}
                        </p>
                      </div>
                      <div>
                        <span className="text-black block font-normal">Dirección Sucursal:</span>
                        <p className="text-zinc-900 leading-snug mt-0.5 font-normal">
                          {settings.address || 'Av. Guayaquil Diagonal al TIA'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-1.5 text-[10px] text-zinc-900 space-y-0.5 font-normal">
                      <div>
                        Telf: {settings.phone || '0963888954'}
                      </div>
                      <div>
                        Email: {settings.email || 'jhon.cruz_95@hotmail.com'}
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] space-y-0.5">
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
                <div className="border border-black rounded-2xl p-3.5 flex flex-col justify-between text-[10.5px] bg-white">
                  <div>
                    <div className="text-[15px] font-bold text-black tracking-tight">
                      R.U.C.: <span className="font-bold">{settings.taxId || '1207083070001'}</span>
                    </div>
                    <div className="text-[18px] font-bold text-black tracking-normal mt-1.5 uppercase">
                      {activeInvoice.documentType === 'FACTURA' ? 'FACTURA' : getDocumentTypeName(activeInvoice.documentType).toUpperCase()}
                    </div>
                    <div className="text-[13px] font-bold text-black mt-1 mb-2">
                      No. {activeInvoice.fullNumber || '001-005-000000119'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10.5px] font-bold text-black uppercase tracking-tight">
                      NÚMERO DE AUTORIZACIÓN:
                    </div>
                    <div className="text-[9.5px] font-mono text-zinc-900 leading-tight mt-0.5 mb-2 select-all break-all tracking-normal">
                      {activeInvoice.sriNumeroAutorizacion || claveAccesoCalculada}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10.5px] font-bold text-black uppercase tracking-tight">
                      FECHA Y HORA DE AUTORIZACIÓN:
                    </div>
                    <div className="text-[10.5px] text-zinc-900 mt-0.5 mb-2 font-normal">
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

                  <div className="space-y-1 mb-2 text-[10px]">
                    <div className="flex items-center">
                      <span className="font-bold text-black w-28 uppercase">AMBIENTE:</span>
                      <span className="uppercase text-zinc-900 font-normal">
                        {sriMode === 'PRODUCCION' ? 'PRODUCCIÓN' : 'PRUEBAS'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-bold text-black w-28 uppercase">EMISIÓN:</span>
                      <span className="uppercase text-zinc-900 font-normal">NORMAL</span>
                    </div>
                  </div>

                  {/* Código de barras Code 128 con número de 49 dígitos centrado debajo */}
                  <div className="pt-1 w-full flex flex-col items-center">
                    <svg ref={barcodeRef} className="w-full max-w-[320px] h-9"></svg>
                    <span className="font-mono text-[9px] tracking-wider text-black font-medium mt-0.5 select-all text-center">
                      {claveAccesoCalculada}
                    </span>
                  </div>
                </div>
              </div>

              {/* CLIENT / RECEPTOR SECTION - High rounded corners matching image */}
              <div className="border border-black rounded-xl p-2.5 bg-white mt-2.5 text-[11px] space-y-1">
                <div className="grid grid-cols-[210px_1fr] items-center">
                  <span className="text-black">Razón Social / Nombres y Apellidos:</span>
                  <span className="font-bold uppercase text-black">{activeInvoice.customer.name || 'CRUZ SANCHEZ JHON ANDRES'}</span>
                </div>
                <div className="grid grid-cols-[210px_1fr] items-center">
                  <span className="text-black">Identificación:</span>
                  <span className="font-bold text-black">{activeInvoice.customer.docNumber || '1207083070001'}</span>
                </div>
                <div className="grid grid-cols-[210px_1fr] items-center">
                  <span className="text-black">Fecha:</span>
                  <span className="font-bold text-black">{(() => {
                    const d = new Date(activeInvoice.createdAt);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                  })()}</span>
                </div>
                <div className="grid grid-cols-[210px_1fr] items-center">
                  <span className="text-black">Dirección:</span>
                  <span className="text-black">{activeInvoice.customer.address || 'Puembo'}</span>
                </div>
              </div>

              {/* PRODUCTS / DETAILS TABLE - Official SRI layout matching image */}
              <div className="mt-2.5 overflow-x-auto">
                <table className="w-full border border-black border-collapse text-[10px] bg-white">
                  <thead>
                    <tr className="border-b border-black font-bold text-black text-center bg-slate-50/50">
                      <th className="border-r border-black p-1.5">Cod.<br/>Principal</th>
                      <th className="border-r border-black p-1.5">Cod.<br/>Auxiliar</th>
                      <th className="border-r border-black p-1.5">Cantidad</th>
                      <th className="border-r border-black p-1.5 text-center">Descripción</th>
                      <th className="border-r border-black p-1.5">Detalle<br/>Adicional</th>
                      <th className="border-r border-black p-1.5">Precio<br/>Unitario</th>
                      <th className="border-r border-black p-1.5">Subsidio</th>
                      <th className="border-r border-black p-1.5">Precio sin<br/>Subsidio</th>
                      <th className="border-r border-black p-1.5">Descuento</th>
                      <th className="p-1.5">Precio<br/>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInvoice.items.map((it, idx) => {
                      const code = (it as any).productCode || (it as any).code || it.sku || String(idx + 1).padStart(4, '0');
                      const desc = it.productName || (it as any).description || (it as any).name || `Producto ${idx + 1}`;
                      const qty = it.quantity || 1;
                      const unitPrice = it.unitPrice || (it as any).price || 0;
                      const discountAmount = Math.round(((unitPrice * qty * (it.discountPercent || 0)) / 100) * 100) / 100;
                      const lineBase = Math.max(0, Math.round((unitPrice * qty - discountAmount) * 100) / 100);

                      // Determine item tax rate accurately
                      let itemTaxRate = settings.defaultTaxRate ?? 15;
                      if (typeof it.taxRate === 'number') {
                        itemTaxRate = it.taxRate;
                      } else if (typeof (it as any).taxPercent === 'number') {
                        itemTaxRate = (it as any).taxPercent;
                      } else if (it.taxAmount === 0 && (it.subtotal || unitPrice) > 0) {
                        itemTaxRate = 0;
                      } else if (it.taxAmount > 0 && lineBase > 0) {
                        itemTaxRate = Math.round((it.taxAmount / lineBase) * 100);
                      }

                      return (
                        <tr key={idx} className="border-b border-black text-black">
                          <td className="border-r border-black p-1.5 text-center">{code}</td>
                          <td className="border-r border-black p-1.5 text-center">{code}</td>
                          <td className="border-r border-black p-1.5 text-center font-normal">{qty.toFixed(2)}</td>
                          <td className="border-r border-black p-1.5 text-left">{desc}</td>
                          <td className="border-r border-black p-1.5 text-center font-semibold text-[9px]">
                            IVA {itemTaxRate}%
                          </td>
                          <td className="border-r border-black p-1.5 text-center">${unitPrice.toFixed(2)}</td>
                          <td className="border-r border-black p-1.5 text-center">0.00</td>
                          <td className="border-r border-black p-1.5 text-center">0.00</td>
                          <td className="border-r border-black p-1.5 text-center">${discountAmount.toFixed(2)}</td>
                          <td className="p-1.5 text-center font-medium">${lineBase.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* BOTTOM SECTION: Additional Info (Left) + Totals Breakdown (Right) - 2 Columnas Side-by-Side */}
              {(() => {
                const sriBreakdown = calculateSriTotals(activeInvoice.items, settings.defaultTaxRate);
                const subtotal15 = sriBreakdown.subtotal15;
                const subtotal5 = sriBreakdown.subtotal5;
                const subtotal0 = sriBreakdown.subtotal0;
                const subtotalNoObjeto = sriBreakdown.subtotalNoObjeto;
                const subtotalExento = sriBreakdown.subtotalExento;
                const subtotalSinImpuestos = sriBreakdown.subtotalSinImpuestos;
                const totalDescuento = sriBreakdown.totalDescuento;
                const valorIce = sriBreakdown.valorIce;
                const iva15 = sriBreakdown.iva15;
                const iva5 = sriBreakdown.iva5;
                const total = sriBreakdown.valorAPagar;

                return (
                  <div className="grid grid-cols-2 gap-3 items-start mt-2.5" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    {/* Left Column: Información Adicional con Forma de Pago al final */}
                    <div className="border border-black rounded-xl p-3 bg-white text-[10.5px] flex flex-col justify-between h-full">
                      <div className="space-y-2">
                        <h4 className="font-bold text-[11.5px] text-black">Información Adicional</h4>
                        
                        <div className="space-y-1 pt-0.5 text-black text-[10px]">
                          <div>
                            <span className="font-semibold">Email Cliente: </span>
                            <span>{activeInvoice.customer.email || 'jhon.cruz_95@hotmail.com'}</span>
                          </div>
                          <div>
                            <span className="font-semibold">Teléfono: </span>
                            <span>{activeInvoice.customer.phone || '0963888954'}</span>
                          </div>
                          <div>
                            <span className="font-semibold">Dirección: </span>
                            <span>{activeInvoice.customer.address || 'Puembo'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 text-black text-[10px] flex items-center border-t border-slate-200 mt-2">
                        <span className="font-semibold">Forma de Pago:</span>
                        <span className="font-bold uppercase ml-2">
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
                      <table className="w-full text-[10px] border border-black border-collapse bg-white">
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">SUBTOTAL 15%</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${subtotal15.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">SUBTOTAL 5%</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${subtotal5.toFixed(2)}</td>
                          </tr>
                          {sriBreakdown.subtotalEspecial > 0 && (
                            <tr className="border-b border-black">
                              <td className="py-0.5 px-2 border-r border-black text-black">SUBTOTAL OTRAS TARIFAS</td>
                              <td className="py-0.5 px-2 text-right font-medium text-black">${sriBreakdown.subtotalEspecial.toFixed(2)}</td>
                            </tr>
                          )}
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">SUBTOTAL 0%</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${subtotal0.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">SUBTOTAL NO OBJETO DE IVA</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${subtotalNoObjeto.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">SUBTOTAL EXENTO DE IVA</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${subtotalExento.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">SUBTOTAL SIN IMPUESTOS</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${subtotalSinImpuestos.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">TOTAL DESCUENTO</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${totalDescuento.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">ICE</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${valorIce.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">IVA 15%</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${iva15.toFixed(2)}</td>
                          </tr>
                          {iva5 > 0 && (
                            <tr className="border-b border-black">
                              <td className="py-0.5 px-2 border-r border-black text-black">IVA 5%</td>
                              <td className="py-0.5 px-2 text-right font-medium text-black">${iva5.toFixed(2)}</td>
                            </tr>
                          )}
                          {sriBreakdown.ivaEspecial > 0 && (
                            <tr className="border-b border-black">
                              <td className="py-0.5 px-2 border-r border-black text-black">IVA OTRAS TARIFAS</td>
                              <td className="py-0.5 px-2 text-right font-medium text-black">${sriBreakdown.ivaEspecial.toFixed(2)}</td>
                            </tr>
                          )}
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">IVA 0%</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">IRBPNR</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">$0.00</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-r border-black text-black">PROPINA</td>
                            <td className="py-0.5 px-2 text-right font-medium text-black">${sriBreakdown.propina10Amount.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-black font-bold text-[12px] bg-slate-50/50">
                            <td className="py-1 px-2 border-r border-black text-black font-bold">VALOR TOTAL</td>
                            <td className="py-1 px-2 text-right font-bold text-black">${total.toFixed(2)}</td>
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
            <div id="printable-invoice" className="ticket-80mm bg-white text-slate-900 rounded-xl p-4 sm:p-5 shadow-xl mx-auto w-full max-w-[320px] font-mono text-[11px] leading-snug border border-slate-300">
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
                <p>DIRECCIÓN: {activeInvoice.customer.address || 'S/N'}</p>
                {activeInvoice.customer.phone && (
                  <p>TEL: {activeInvoice.customer.phone}</p>
                )}
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-2">
                {activeInvoice.items.map((item, idx) => {
                  let itemTaxRate = settings.defaultTaxRate ?? 15;
                  if (typeof item.taxRate === 'number') {
                    itemTaxRate = item.taxRate;
                  } else if (typeof (item as any).taxPercent === 'number') {
                    itemTaxRate = (item as any).taxPercent;
                  } else if (item.taxAmount === 0 && (item.subtotal || item.unitPrice) > 0) {
                    itemTaxRate = 0;
                  }
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-slate-900">{item.productName}</p>
                        <span className="text-[9.5px] font-semibold text-slate-600 ml-1">IVA {itemTaxRate}%</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>
                          {item.quantity} {item.unit} x {formatCurrency(item.unitPrice, settings.currencySymbol)}
                        </span>
                        <span className="font-bold">{formatCurrency(item.total, settings.currencySymbol)}</span>
                      </div>
                    </div>
                  );
                })}
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

              {/* ── CÓDIGO QR AUTORIZADO POR EL SRI (49 DÍGITOS) ────────────────── */}
              {activeInvoice.documentType !== 'COTIZACION' && (
                <div className="py-3 border-b border-dashed border-slate-400 flex flex-col items-center justify-center text-center space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-800">
                    AUTORIZACIÓN SRI - COMPROBANTE ELECTRÓNICO
                  </span>
                  {qrCodeDataUrl ? (
                    <div className="p-1.5 bg-white border border-slate-300 rounded-lg inline-block shadow-2xs">
                      <img
                        src={qrCodeDataUrl}
                        alt="Código QR SRI - 49 Dígitos"
                        className="w-28 h-28 object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="w-28 h-28 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[9px] text-slate-400">
                      Generando QR...
                    </div>
                  )}
                  <div className="space-y-0.5 max-w-[260px] px-1">
                    <span className="text-[8px] font-bold text-slate-500 uppercase block">
                      Clave de Acceso (49 Dígitos):
                    </span>
                    <p className="text-[8.5px] font-mono font-bold tracking-tight text-slate-900 break-all leading-tight select-all">
                      {claveAccesoCalculada}
                    </p>
                  </div>
                  <span className="text-[7.5px] text-slate-500 block">
                    Escanee el código QR para validar su comprobante en sri.gob.ec
                  </span>
                </div>
              )}

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
      autoTransmit={activeInvoice.sriStatus !== 'AUTORIZADO'}
    />

    {/* ── MODAL: CONFIRMAR ANULACIÓN CON NOTA DE CRÉDITO ─────────────────── */}
    {isAnularModalOpen && (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 text-slate-900 my-auto animate-scaleUp">
          {/* Header */}
          <div className="bg-slate-950 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
                <CreditCard className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Anular con Nota de Crédito</h3>
                <p className="text-xs text-slate-400 font-medium">
                  {activeInvoice.fullNumber} • {activeInvoice.customer?.name || 'Consumidor Final'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAnularModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Info Box SRI */}
            {((activeInvoice.customer?.docNumber || '').trim() === '9999999999999' ||
              (activeInvoice.customer?.docNumber || '').trim() === '9999999999' ||
              (activeInvoice.customer?.name || '').toUpperCase().includes('CONSUMIDOR FINAL') ||
              (activeInvoice.customer?.name || '').toUpperCase().includes('PUBLICO GENERAL')) ? (
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    SRI — Factura a Consumidor Final
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-mono text-[10px] font-bold">
                    Control Interno
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Por disposición del SRI (<strong>Resolución NAC-DGERCGC25-00000017</strong>), las facturas emitidas a <strong>Consumidor Final</strong> no admiten Notas de Crédito electrónicas autorizadas ante el SRI. La anulación se gestionará localmente para restituir el stock al inventario y registrar la anulación interna sin enviar al SRI (evitando rechazos de recepción).
                </p>
                <div className="pt-2 border-t border-amber-200/60 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Comprobante Interno:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {(establishment || '001').padStart(3, '0')}-{(emissionPoint || '001').padStart(3, '0')}-{(secCreditNote || '000000001').padStart(9, '0')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Monto Total a Anular:</span>
                    <span className="font-mono font-black text-rose-700">
                      ${(activeInvoice.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    SRI — Anulación Oficial
                  </span>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-mono text-[10px] font-bold">
                    Comprobante Tipo 04
                  </span>
                </div>
                <p className="text-[11px] text-rose-900 leading-relaxed">
                  En la normativa tributaria del Ecuador (SRI), la anulación de una factura se realiza mediante la emisión de una <strong>Nota de Crédito electrónica</strong> que anula el comprobante y revierte los valores correspondientes.
                </p>
                <div className="pt-2 border-t border-rose-200/60 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Próxima Nota de Crédito:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {(establishment || '001').padStart(3, '0')}-{(emissionPoint || '001').padStart(3, '0')}-{(secCreditNote || '000000001').padStart(9, '0')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Monto Total a Anular:</span>
                    <span className="font-mono font-black text-rose-700">
                      ${(activeInvoice.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Motivo de Anulación / Nota de Crédito *</label>
              <select
                value={anularReason}
                onChange={(e) => setAnularReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="Anulación total de la factura">Anulación total de la factura</option>
                <option value="Error de digitación o datos del cliente">Error de digitación o datos del cliente</option>
                <option value="Devolución de mercadería">Devolución de mercadería</option>
                <option value="Venta cancelada / Solicitud del cliente">Venta cancelada / Solicitud del cliente</option>
                <option value="Cambio de producto o forma de pago">Cambio de producto o forma de pago</option>
                <option value="Comprobante duplicado">Comprobante duplicado</option>
                <option value="Otro motivo">Otro motivo</option>
              </select>
            </div>

            {/* Checkbox de restitución de stock */}
            <div className="pt-1">
              <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
                <input
                  type="checkbox"
                  checked={anularRestoreStock}
                  onChange={(e) => setAnularRestoreStock(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-slate-800 block">Devolver productos al stock de inventario</span>
                  <span className="text-[10px] text-slate-500 block">Reintegra automáticamente las cantidades vendidas a bodega</span>
                </div>
              </label>
            </div>

            {/* Live Progress Banner */}
            {isAnulando && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900 animate-pulse">
                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
                <div className="min-w-0">
                  <p className="font-black text-amber-950">Transmitiendo a API SRI (:8080)...</p>
                  <p className="text-[11px] text-amber-700 truncate">{anularStepText || 'Firmando y procesando comprobante...'}</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAnularModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isAnulando}
                onClick={handleConfirmAnular}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>{isAnulando ? 'Generando N/C y Anulando...' : 'Confirmar Anulación y Emitir N/C'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── MODAL: VISOR DE NOTA DE CRÉDITO GENERADA ───────────────────────── */}
    {viewingCreditNote && (
      <CreditNoteViewerModal
        isOpen={!!viewingCreditNote}
        onClose={() => setViewingCreditNote(null)}
        creditNote={viewingCreditNote}
        settings={settings}
        invoices={currentInvoice ? [currentInvoice] : []}
        onUpdateCreditNote={(updated) => {
          setViewingCreditNote(updated);
          setCreditNotes((prev) => prev.map((cn) => (cn.id === updated.id ? updated : cn)));
        }}
      />
    )}
  </>
);
};

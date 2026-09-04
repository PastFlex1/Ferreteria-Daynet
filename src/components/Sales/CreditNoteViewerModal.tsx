import React, { useRef, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  Building2, 
  FileText, 
  CreditCard 
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { CreditNoteData, Invoice, StoreSettings } from '../../types';
import { formatCurrency, formatFullDate } from '../../utils/formatters';
import { downloadCreditNotePdf, printCreditNoteDocument } from '../../utils/creditNotePdfGenerator';

interface CreditNoteViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditNote: CreditNoteData | null;
  settings: StoreSettings;
  invoices?: Invoice[];
}

export const CreditNoteViewerModal: React.FC<CreditNoteViewerModalProps> = ({
  isOpen,
  onClose,
  creditNote,
  settings,
  invoices = [],
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  const claveAcceso = creditNote?.claveAcceso || creditNote?.numeroAutorizacion || '040920260417900123450011001001000000001123456781';

  // Render Barcode
  useEffect(() => {
    if (isOpen && barcodeRef.current && claveAcceso) {
      try {
        JsBarcode(barcodeRef.current, claveAcceso, {
          format: 'CODE128',
          width: 1.1,
          height: 38,
          displayValue: false,
          margin: 0,
        });
      } catch (err) {
        console.error('Error generating barcode for credit note:', err);
      }
    }
  }, [isOpen, claveAcceso]);

  if (!isOpen || !creditNote) return null;

  // Resolve items: from creditNote or from referenced invoice
  let items = creditNote.items || [];
  if (items.length === 0 && invoices.length > 0) {
    const matched = invoices.find(
      (inv) => inv.fullNumber === creditNote.invoiceRef || inv.id === creditNote.invoiceRef
    );
    if (matched && matched.items) {
      items = matched.items;
    }
  }

  const subtotal = creditNote.subtotal ?? Math.round((creditNote.amount / 1.15) * 100) / 100;
  const tax = creditNote.tax ?? Math.round((creditNote.amount - subtotal) * 100) / 100;
  const total = creditNote.amount;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 print:p-0 print:bg-white animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-h-none print:w-full">
        
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
              <CreditCard className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Nota de Crédito Electrónica
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {creditNote.status || 'AUTORIZADO'}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 font-bold mt-0.5">
                No. {creditNote.id} • Ref: {creditNote.invoiceRef}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printCreditNoteDocument(creditNote, settings, invoices)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Imprimir Nota de Crédito"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={() => downloadCreditNotePdf(creditNote, settings, invoices)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Descargar en PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Standard RIDE SRI format */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-5 bg-white text-slate-900 text-xs">
          
          {/* Top Section: Issuer Info + Official SRI Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            
            {/* Left Box: Issuer Details */}
            <div className="border border-black rounded-2xl p-5 flex flex-col justify-between bg-white space-y-4">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 bg-slate-100 rounded-xl border border-slate-300">
                    <Building2 className="w-5 h-5 text-slate-800" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-black uppercase leading-tight">
                      {settings.storeName || 'FERRETERÍA & SUMINISTROS'}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-600">
                      {settings.legalName || settings.storeName}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 text-[11.5px] text-black">
                  <p><strong>Dirección Matriz:</strong> {settings.address || 'Matriz'}</p>
                  <p><strong>Teléfono:</strong> {settings.phone || 'S/N'}</p>
                  {settings.email && <p><strong>Email:</strong> {settings.email}</p>}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 text-[11px] font-bold text-black space-y-1">
                <div>OBLIGADO A LLEVAR CONTABILIDAD: {settings.accountingRequired ? 'SÍ' : 'NO'}</div>
                <div>CONTRIBUYENTE RÉGIMEN RIMPE</div>
              </div>
            </div>

            {/* Right Box: SRI Official Header */}
            <div className="border border-black rounded-2xl p-5 flex flex-col justify-between bg-white space-y-3">
              <div>
                <div className="text-[14px] font-bold text-black">
                  R.U.C.: <span className="font-mono">{settings.taxId || '1790012345001'}</span>
                </div>
                <div className="text-[18px] font-black text-rose-600 tracking-tight mt-1 uppercase">
                  NOTA DE CRÉDITO
                </div>
                <div className="text-[13px] font-bold text-black font-mono mt-0.5">
                  No. {creditNote.id}
                </div>
              </div>

              <div className="space-y-2 text-[11px]">
                <div>
                  <div className="font-bold text-black uppercase">NÚMERO DE AUTORIZACIÓN:</div>
                  <div className="font-mono text-[10px] text-slate-800 break-all leading-tight select-all mt-0.5">
                    {creditNote.numeroAutorizacion || claveAcceso}
                  </div>
                </div>

                <div>
                  <div className="font-bold text-black uppercase">FECHA Y HORA DE AUTORIZACIÓN:</div>
                  <div className="text-slate-800 mt-0.5">
                    {formatFullDate(creditNote.fechaAutorizacion || creditNote.date)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px]">
                  <span><strong>AMBIENTE:</strong> PRODUCCIÓN</span>
                  <span><strong>EMISIÓN:</strong> NORMAL</span>
                </div>
              </div>

              {/* Barcode & Key */}
              <div className="pt-2 flex flex-col items-center border-t border-slate-100">
                <svg ref={barcodeRef} className="w-full max-w-[340px] h-10"></svg>
                <span className="font-mono text-[9.5px] text-slate-800 select-all tracking-wider text-center mt-1">
                  {claveAcceso}
                </span>
              </div>
            </div>
          </div>

          {/* Middle Section: Comprobante Modificado + Datos del Cliente */}
          <div className="border border-black rounded-2xl p-5 bg-white grid grid-cols-1 md:grid-cols-2 gap-5 text-[11.5px]">
            <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4">
              <h4 className="font-bold uppercase text-black text-[12px] pb-1 border-b border-black/20">
                Comprobante que se Modifica
              </h4>
              <p><strong>Comprobante:</strong> <span className="font-bold">FACTURA</span></p>
              <p><strong>Número:</strong> <span className="font-mono font-bold text-orange-600">{creditNote.invoiceRef}</span></p>
              <p><strong>Fecha Emisión Factura:</strong> {creditNote.invoiceDate ? formatFullDate(creditNote.invoiceDate) : formatFullDate(creditNote.date)}</p>
              <p><strong>Razón de Modificación:</strong> <span className="font-semibold text-slate-900">{creditNote.reason}</span></p>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold uppercase text-black text-[12px] pb-1 border-b border-black/20">
                Datos del Cliente / Comprador
              </h4>
              <p><strong>Razón Social / Nombres:</strong> <span className="font-bold uppercase">{creditNote.customer}</span></p>
              <p><strong>Identificación (RUC / C.I.):</strong> <span className="font-mono font-bold">{creditNote.customerRuc || '9999999999999'}</span></p>
              <p><strong>Fecha Emisión N/C:</strong> {formatFullDate(creditNote.date)}</p>
              <p><strong>Dirección:</strong> {creditNote.customerAddress || 'Matriz'}</p>
            </div>
          </div>

          {/* Items / Details Table */}
          <div className="border border-black rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-black text-white uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-2 pl-3 text-center">Código</th>
                  <th className="p-2 text-left">Descripción / Concepto</th>
                  <th className="p-2 text-center">Cantidad</th>
                  <th className="p-2 text-right">Precio Unitario</th>
                  <th className="p-2 pr-3 text-right">Total Modificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/20 bg-white">
                {items.length > 0 ? (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 text-center font-mono">{it.sku || idx + 1}</td>
                      <td className="p-2 font-medium">{it.productName || 'Producto'}</td>
                      <td className="p-2 text-center font-bold">{it.quantity || 1}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice || 0, settings.currencySymbol)}</td>
                      <td className="p-2 pr-3 text-right font-mono font-bold">{formatCurrency(it.subtotal || it.total || 0, settings.currencySymbol)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2 text-center font-mono">NC-01</td>
                    <td className="p-2 font-medium">Ajuste / {creditNote.reason}</td>
                    <td className="p-2 text-center font-bold">1.00</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(subtotal, settings.currencySymbol)}</td>
                    <td className="p-2 pr-3 text-right font-mono font-bold">{formatCurrency(subtotal, settings.currencySymbol)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Totals */}
          <div className="flex justify-end">
            <table className="w-72 text-[11px] border border-black border-collapse bg-white">
              <tbody>
                <tr className="border-b border-black">
                  <td className="p-1.5 pl-3 border-r border-black font-medium">SUBTOTAL 15%</td>
                  <td className="p-1.5 pr-3 text-right font-mono font-bold">{formatCurrency(subtotal, settings.currencySymbol)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 pl-3 border-r border-black font-medium">SUBTOTAL 0%</td>
                  <td className="p-1.5 pr-3 text-right font-mono font-bold">$0.00</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 pl-3 border-r border-black font-medium">SUBTOTAL SIN IMPUESTOS</td>
                  <td className="p-1.5 pr-3 text-right font-mono font-bold">{formatCurrency(subtotal, settings.currencySymbol)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 pl-3 border-r border-black font-medium">IVA 15%</td>
                  <td className="p-1.5 pr-3 text-right font-mono font-bold">{formatCurrency(tax, settings.currencySymbol)}</td>
                </tr>
                <tr className="bg-slate-900 text-white font-black text-[12.5px]">
                  <td className="p-2 pl-3 border-r border-black text-white uppercase">VALOR TOTAL</td>
                  <td className="p-2 pr-3 text-right font-mono text-orange-400 font-black text-sm">
                    {formatCurrency(total, settings.currencySymbol)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 print:hidden">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Documento Electrónico válido y autorizado por el SRI Ecuador</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printCreditNoteDocument(creditNote, settings, invoices)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span>Imprimir Nota de Crédito</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

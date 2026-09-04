import jsPDF from 'jspdf';
import { CreditNoteData, Invoice, StoreSettings } from '../types';
import { formatCurrency, formatFullDate } from './formatters';

export const downloadCreditNotePdf = (
  creditNote: CreditNoteData,
  settings: StoreSettings,
  invoices?: Invoice[]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header background banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(settings.storeName || 'FERRETERÍA & SUMINISTROS', 15, y);

  // Subtitle / Legal
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  y += 5;
  doc.text(`RUC: ${settings.taxId || '1790012345001'} | ${settings.legalName || settings.storeName || ''}`, 15, y);
  y += 4;
  doc.text(`Matriz: ${settings.address || 'Matriz'} | Tel: ${settings.phone || 'S/N'}`, 15, y);
  y += 4;
  doc.text(`OBLIGADO A LLEVAR CONTABILIDAD: ${settings.accountingRequired ? 'SÍ' : 'NO'} | RÉGIMEN RIMPE`, 15, y);

  // Credit Note Title and ID on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`NOTA DE CRÉDITO`, pageWidth - 15, 14, { align: 'right' });
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`No. ${creditNote.id}`, pageWidth - 15, 20, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(`ESTADO SRI: ${creditNote.status || 'AUTORIZADO'}`, pageWidth - 15, 26, { align: 'right' });

  y = 42;

  // SRI Authorization & Access Key box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, pageWidth - 30, 22, 2.5, 2.5, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('NÚMERO DE AUTORIZACIÓN / CLAVE DE ACCESO:', 18, y + 5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const clave = creditNote.claveAcceso || creditNote.numeroAutorizacion || '040920260417900123450011001001000000001123456781';
  doc.text(clave, 18, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`AMBIENTE: PRODUCCIÓN  |  EMISIÓN: NORMAL  |  FECHA AUTORIZACIÓN: ${formatFullDate(creditNote.fechaAutorizacion || creditNote.date)}`, 18, y + 16);

  y += 27;

  // Document Modified & Client Info Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, y, pageWidth - 30, 32, 2.5, 2.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE QUE SE MODIFICA:', 20, y + 6);
  doc.text('DATOS DEL BENEFICIARIO / CLIENTE:', pageWidth / 2 + 5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Tipo Comprobante: FACTURA`, 20, y + 12);
  doc.text(`Número Factura: ${creditNote.invoiceRef}`, 20, y + 17);
  doc.text(`Fecha Factura: ${creditNote.invoiceDate ? formatFullDate(creditNote.invoiceDate) : formatFullDate(creditNote.date)}`, 20, y + 22);
  doc.text(`Razón Modificación: ${creditNote.reason}`, 20, y + 27);

  doc.text(`Razón Social: ${creditNote.customer}`, pageWidth / 2 + 5, y + 12);
  doc.text(`RUC / Cédula: ${creditNote.customerRuc || '9999999999999'}`, pageWidth / 2 + 5, y + 17);
  doc.text(`Dirección: ${creditNote.customerAddress || 'Matriz'}`, pageWidth / 2 + 5, y + 22);
  doc.text(`Fecha Emisión N/C: ${formatFullDate(creditNote.date)}`, pageWidth / 2 + 5, y + 27);

  y += 38;

  // Items / Concept Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, pageWidth - 30, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CÓDIGO / ÍTEM', 18, y + 4.8);
  doc.text('DESCRIPCIÓN / MOTIVO', 50, y + 4.8);
  doc.text('CANT.', pageWidth - 65, y + 4.8, { align: 'right' });
  doc.text('P. UNIT', pageWidth - 42, y + 4.8, { align: 'right' });
  doc.text('SUBTOTAL', pageWidth - 18, y + 4.8, { align: 'right' });

  y += 7;

  // Items List or Invoice Fallback
  let items = creditNote.items || [];
  if (items.length === 0 && invoices) {
    const matched = invoices.find(
      (inv) => inv.fullNumber === creditNote.invoiceRef || inv.id === creditNote.invoiceRef
    );
    if (matched && matched.items) {
      items = matched.items;
    }
  }

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  if (items && items.length > 0) {
    items.forEach((item, idx) => {
      if (y > 245) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y, pageWidth - 30, 6.5, 'F');
      }
      doc.text(String(item.sku || `ITM-${idx + 1}`), 18, y + 4.5);
      doc.text(String(item.productName || 'Producto').substring(0, 40), 50, y + 4.5);
      doc.text(String(item.quantity || 1), pageWidth - 65, y + 4.5, { align: 'right' });
      doc.text(formatCurrency(item.unitPrice || 0, settings.currencySymbol), pageWidth - 42, y + 4.5, { align: 'right' });
      doc.text(formatCurrency(item.subtotal || item.total || 0, settings.currencySymbol), pageWidth - 18, y + 4.5, { align: 'right' });
      y += 6.5;
    });
  } else {
    doc.text('NC-01', 18, y + 4.5);
    doc.text(`Ajuste / ${creditNote.reason}`, 50, y + 4.5);
    doc.text('1.00', pageWidth - 65, y + 4.5, { align: 'right' });
    doc.text(formatCurrency(creditNote.subtotal || creditNote.amount, settings.currencySymbol), pageWidth - 42, y + 4.5, { align: 'right' });
    doc.text(formatCurrency(creditNote.subtotal || creditNote.amount, settings.currencySymbol), pageWidth - 18, y + 4.5, { align: 'right' });
    y += 6.5;
  }

  y += 6;

  // Totals Box on bottom right
  const subtotal = creditNote.subtotal ?? Math.round((creditNote.amount / 1.15) * 100) / 100;
  const tax = creditNote.tax ?? Math.round((creditNote.amount - subtotal) * 100) / 100;
  const total = creditNote.amount;

  const totalsTableX = pageWidth - 90;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(totalsTableX, y, 75, 26, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('SUBTOTAL SIN IMPUESTOS:', totalsTableX + 4, y + 6);
  doc.text(formatCurrency(subtotal, settings.currencySymbol), pageWidth - 18, y + 6, { align: 'right' });

  doc.text('SUBTOTAL 15%:', totalsTableX + 4, y + 11);
  doc.text(formatCurrency(subtotal, settings.currencySymbol), pageWidth - 18, y + 11, { align: 'right' });

  doc.text('IVA 15%:', totalsTableX + 4, y + 16);
  doc.text(formatCurrency(tax, settings.currencySymbol), pageWidth - 18, y + 16, { align: 'right' });

  doc.setFillColor(15, 23, 42);
  doc.rect(totalsTableX, y + 19, 75, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('VALOR MODIFICADO:', totalsTableX + 4, y + 24);
  doc.setTextColor(251, 146, 60); // orange-400
  doc.text(formatCurrency(total, settings.currencySymbol), pageWidth - 18, y + 24, { align: 'right' });

  // Signatures
  y += 38;
  if (y < 260) {
    doc.setDrawColor(148, 163, 184);
    doc.line(25, y, 80, y);
    doc.line(pageWidth - 80, y, pageWidth - 25, y);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma Emisor / Autorizado', 52.5, y + 4, { align: 'center' });
    doc.text('Firma Cliente / Receptor', pageWidth - 52.5, y + 4, { align: 'center' });
  }

  doc.save(`Nota_Credito_${creditNote.id}.pdf`);
};

export const printCreditNoteDocument = (
  creditNote: CreditNoteData,
  settings: StoreSettings,
  invoices?: Invoice[]
) => {
  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) {
    window.print();
    return;
  }

  let items = creditNote.items || [];
  if (items.length === 0 && invoices) {
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
  const clave = creditNote.claveAcceso || creditNote.numeroAutorizacion || '040920260417900123450011001001000000001123456781';

  const itemsHtml = items.length > 0
    ? items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 7px 10px; text-align: center; color: #64748b;">${item.sku || idx + 1}</td>
        <td style="padding: 7px 10px; font-weight: 600; color: #1e293b;">${item.productName || 'Producto'}</td>
        <td style="padding: 7px 10px; text-align: center; font-weight: bold; color: #0f172a;">${item.quantity || 1}</td>
        <td style="padding: 7px 10px; text-align: right; color: #475569;">${formatCurrency(item.unitPrice || 0, settings.currencySymbol)}</td>
        <td style="padding: 7px 10px; text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(item.subtotal || item.total || 0, settings.currencySymbol)}</td>
      </tr>
    `).join('')
    : `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 7px 10px; text-align: center; color: #64748b;">NC-01</td>
        <td style="padding: 7px 10px; font-weight: 600; color: #1e293b;">Ajuste por ${creditNote.reason}</td>
        <td style="padding: 7px 10px; text-align: center; font-weight: bold; color: #0f172a;">1.00</td>
        <td style="padding: 7px 10px; text-align: right; color: #475569;">${formatCurrency(subtotal, settings.currencySymbol)}</td>
        <td style="padding: 7px 10px; text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(subtotal, settings.currencySymbol)}</td>
      </tr>
    `;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Nota de Crédito ${creditNote.id}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px; font-size: 11.5px; line-height: 1.4; background: #fff; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .issuer-box { border: 1px solid #000; border-radius: 16px; padding: 16px; display: flex; flex-col; justify-content: space-between; }
        .sri-box { border: 1px solid #000; border-radius: 16px; padding: 16px; }
        .company-name { font-size: 17px; font-weight: 900; color: #000; text-transform: uppercase; margin-bottom: 6px; }
        .doc-title { font-size: 18px; font-weight: 900; color: #000; text-transform: uppercase; margin: 4px 0; }
        .doc-num { font-size: 14px; font-weight: 800; font-family: monospace; color: #000; margin-bottom: 8px; }
        .mono-small { font-family: monospace; font-size: 10px; word-break: break-all; margin: 3px 0 8px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; border: 1px solid #000; border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; }
        .info-col h4 { margin: 0 0 5px 0; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #000; }
        .info-col p { margin: 2px 0; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #000; border-radius: 10px; overflow: hidden; }
        thead th { background: #000; color: #fff; padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .totals-container { display: flex; justify-content: flex-end; margin-bottom: 24px; }
        .totals-table { width: 290px; border-collapse: collapse; border: 1px solid #000; border-radius: 10px; overflow: hidden; }
        .totals-table td { padding: 6px 12px; font-size: 11px; }
        .totals-table tr.total-row { background: #000; color: #fff; font-size: 12px; font-weight: 900; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 40px; text-align: center; }
        .sign-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 10px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header-grid">
        <div class="issuer-box">
          <div>
            <div class="company-name">${settings.storeName || 'FERRETERÍA & SUMINISTROS'}</div>
            <div style="font-size: 11px; color: #334155; margin-bottom: 4px;"><strong>Razón Social:</strong> ${settings.legalName || settings.storeName || ''}</div>
            <div style="font-size: 10.5px; color: #475569;"><strong>Matriz:</strong> ${settings.address || 'Matriz'}</div>
            <div style="font-size: 10.5px; color: #475569;"><strong>Teléfono:</strong> ${settings.phone || 'S/N'}</div>
            ${settings.email ? `<div style="font-size: 10.5px; color: #475569;"><strong>Email:</strong> ${settings.email}</div>` : ''}
          </div>
          <div style="margin-top: 14px; font-size: 10px; font-weight: 700;">
            <div>OBLIGADO A LLEVAR CONTABILIDAD: ${settings.accountingRequired ? 'SÍ' : 'NO'}</div>
            <div>CONTRIBUYENTE RÉGIMEN RIMPE</div>
          </div>
        </div>

        <div class="sri-box">
          <div style="font-size: 13px; font-weight: 800;">R.U.C.: ${settings.taxId || '1790012345001'}</div>
          <div class="doc-title">NOTA DE CRÉDITO</div>
          <div class="doc-num">No. ${creditNote.id}</div>
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase;">NÚMERO DE AUTORIZACIÓN:</div>
          <div class="mono-small">${creditNote.numeroAutorizacion || clave}</div>
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase;">FECHA Y HORA DE AUTORIZACIÓN:</div>
          <div style="font-size: 10.5px; margin-bottom: 6px;">${formatFullDate(creditNote.fechaAutorizacion || creditNote.date)}</div>
          <div style="font-size: 10px; display: flex; gap: 16px; margin-bottom: 6px;">
            <span><strong>AMBIENTE:</strong> PRODUCCIÓN</span>
            <span><strong>EMISIÓN:</strong> NORMAL</span>
          </div>
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase;">CLAVE DE ACCESO:</div>
          <div class="mono-small">${clave}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-col">
          <h4>Comprobante que se Modifica</h4>
          <p><strong>Comprobante:</strong> FACTURA</p>
          <p><strong>Número:</strong> ${creditNote.invoiceRef}</p>
          <p><strong>Fecha Emisión Factura:</strong> ${creditNote.invoiceDate ? formatFullDate(creditNote.invoiceDate) : formatFullDate(creditNote.date)}</p>
          <p><strong>Razón Modificación:</strong> ${creditNote.reason}</p>
        </div>
        <div class="info-col">
          <h4>Datos del Cliente / Comprador</h4>
          <p><strong>Razón Social / Nombre:</strong> ${creditNote.customer}</p>
          <p><strong>Identificación (RUC/CI):</strong> ${creditNote.customerRuc || '9999999999999'}</p>
          <p><strong>Fecha Emisión:</strong> ${formatFullDate(creditNote.date)}</p>
          <p><strong>Dirección:</strong> ${creditNote.customerAddress || 'Matriz'}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 70px; text-align: center;">Código</th>
            <th style="text-align: left;">Descripción</th>
            <th style="width: 50px; text-align: center;">Cant.</th>
            <th style="width: 75px; text-align: right;">P. Unit</th>
            <th style="width: 75px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals-container">
        <table class="totals-table">
          <tr>
            <td style="border-bottom: 1px solid #e2e8f0;">SUBTOTAL 15%:</td>
            <td style="border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${formatCurrency(subtotal, settings.currencySymbol)}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #e2e8f0;">SUBTOTAL 0%:</td>
            <td style="border-bottom: 1px solid #e2e8f0; text-align: right;">$0.00</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #e2e8f0;">SUBTOTAL SIN IMPUESTOS:</td>
            <td style="border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${formatCurrency(subtotal, settings.currencySymbol)}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #e2e8f0;">IVA 15%:</td>
            <td style="border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${formatCurrency(tax, settings.currencySymbol)}</td>
          </tr>
          <tr class="total-row">
            <td>VALOR TOTAL:</td>
            <td style="text-align: right; font-size: 13px;">${formatCurrency(total, settings.currencySymbol)}</td>
          </tr>
        </table>
      </div>

      <div class="signatures">
        <div>
          <div class="sign-line">Firma Emisor / Autorizado</div>
        </div>
        <div>
          <div class="sign-line">Firma Cliente / Aceptación</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
};

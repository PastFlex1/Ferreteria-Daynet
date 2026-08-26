import jsPDF from 'jspdf';
import { Order } from '../components/Sales/CreateOrderModal';
import { StoreSettings } from '../types';
import { formatCurrency, formatFullDate } from './formatters';

export const downloadOrderPdf = (order: Order, settings: StoreSettings) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header background banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(settings.storeName || 'FERRETERÍA & SUMINISTROS', 15, y);

  // Subtitle / Legal
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  y += 5;
  doc.text(`RUC: ${settings.taxId || '9999999999001'} | ${settings.legalName || ''}`, 15, y);
  y += 4;
  doc.text(`Dirección: ${settings.address || 'Matriz'} | Tel: ${settings.phone || 'S/N'}`, 15, y);

  // Order Badge / Title on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(249, 115, 22); // orange-500
  doc.text(`PEDIDO DE VENTA`, pageWidth - 15, 14, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`${order.id}`, pageWidth - 15, 20, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Estado: ${order.status}`, pageWidth - 15, 26, { align: 'right' });

  y = 40;

  // Customer & Info Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(15, y, pageWidth - 30, 28, 3, 3, 'FD');

  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE:', 20, y + 6);
  doc.text('INFORMACIÓN DE ENTREGA Y FECHA:', pageWidth / 2 + 10, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Cliente: ${order.customerName}`, 20, y + 12);
  doc.text(`RUC / C.I.: ${order.customerRuc || 'Consumidor Final'}`, 20, y + 17);
  if (order.notes) {
    doc.text(`Observación: ${order.notes.substring(0, 42)}`, 20, y + 22);
  }

  doc.text(`Fecha Emisión: ${formatFullDate(order.date)}`, pageWidth / 2 + 10, y + 12);
  doc.text(`Dirección Entrega: ${order.deliveryAddress || 'En local / Retiro en tienda'}`, pageWidth / 2 + 10, y + 17);
  doc.text(`Ítems: ${order.itemsCount || order.items.length} productos`, pageWidth / 2 + 10, y + 22);

  y += 36;

  // Items Table Header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(15, y, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('#', 18, y + 5.5);
  doc.text('DESCRIPCIÓN DEL PRODUCTO', 28, y + 5.5);
  doc.text('CANT.', pageWidth - 65, y + 5.5, { align: 'right' });
  doc.text('P. UNIT', pageWidth - 40, y + 5.5, { align: 'right' });
  doc.text('SUBTOTAL', pageWidth - 18, y + 5.5, { align: 'right' });

  y += 8;

  // Items List
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  order.items.forEach((item, index) => {
    // Alternating row background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, pageWidth - 30, 7, 'F');
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 7, pageWidth - 15, y + 7);

    doc.text(String(index + 1), 18, y + 5);
    const prodName = item.productName.length > 55 ? item.productName.substring(0, 52) + '...' : item.productName;
    doc.text(prodName, 28, y + 5);
    doc.text(String(item.qty), pageWidth - 65, y + 5, { align: 'right' });
    doc.text(formatCurrency(item.unitPrice, settings.currencySymbol), pageWidth - 40, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.subtotal, settings.currencySymbol), pageWidth - 18, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += 7;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  });

  y += 6;

  // Totals Box
  const totalsBoxX = pageWidth - 85;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(totalsBoxX, y, 70, 28, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Subtotal:', totalsBoxX + 5, y + 6);
  doc.text(formatCurrency(order.subtotal, settings.currencySymbol), pageWidth - 18, y + 6, { align: 'right' });

  doc.text(`IVA (${settings.defaultTaxRate || 15}%):`, totalsBoxX + 5, y + 12);
  doc.text(formatCurrency(order.tax, settings.currencySymbol), pageWidth - 18, y + 12, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(totalsBoxX + 5, y + 16, pageWidth - 18, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(234, 88, 12); // orange-600
  doc.text('TOTAL:', totalsBoxX + 5, y + 23);
  doc.text(formatCurrency(order.total, settings.currencySymbol), pageWidth - 18, y + 23, { align: 'right' });

  // Signatures
  y += 38;
  if (y > 265) {
    doc.addPage();
    y = 30;
  }
  doc.setDrawColor(148, 163, 184);
  doc.line(30, y, 80, y);
  doc.line(pageWidth - 80, y, pageWidth - 30, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Firma Autorizada / Vendedor', 55, y + 4, { align: 'center' });
  doc.text('Recibí Conforme / Cliente', pageWidth - 55, y + 4, { align: 'center' });

  // Footer notes
  y += 12;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(settings.footerNotes || 'Documento no válido como factura. Comprobante interno de pedido.', pageWidth / 2, y, { align: 'center' });

  doc.save(`Pedido-${order.id}.pdf`);
};

export const printOrderDocument = (order: Order, settings: StoreSettings) => {
  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) {
    window.print();
    return;
  }

  const itemsHtml = order.items
    .map(
      (item, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 10px; font-size: 11px; text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="padding: 8px 10px; font-size: 12px; font-weight: 600; color: #1e293b;">${item.productName}</td>
      <td style="padding: 8px 10px; font-size: 12px; text-align: center; font-weight: bold; color: #0f172a;">${item.qty}</td>
      <td style="padding: 8px 10px; font-size: 12px; text-align: right; color: #475569;">${formatCurrency(item.unitPrice, settings.currencySymbol)}</td>
      <td style="padding: 8px 10px; font-size: 12px; text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(item.subtotal, settings.currencySymbol)}</td>
    </tr>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Pedido ${order.id}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px; font-size: 12px; line-height: 1.4; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
        .company-name { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
        .company-info { font-size: 10.5px; color: #64748b; margin-top: 2px; }
        .order-badge { text-align: right; }
        .order-title { font-size: 16px; font-weight: 900; color: #ea580c; text-transform: uppercase; }
        .order-id { font-size: 14px; font-weight: 800; font-family: monospace; color: #0f172a; margin-top: 2px; }
        .order-status { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 9px; font-weight: 800; text-transform: uppercase; background: #ffedd5; color: #c2410c; margin-top: 4px; border: 1px solid #fed7aa; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
        .info-col h4 { margin: 0 0 6px 0; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
        .info-col p { margin: 3px 0; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border-radius: 8px; overflow: hidden; }
        thead th { background: #0f172a; color: #ffffff; padding: 9px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        .totals-container { display: flex; justify-content: flex-end; margin-bottom: 30px; }
        .totals-table { width: 280px; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
        .totals-table td { padding: 7px 14px; font-size: 11px; }
        .totals-table tr.total-row { background: #0f172a; color: #fff; font-size: 13px; font-weight: 900; }
        .totals-table tr.total-row td { color: #fb923c; font-size: 14px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 40px; text-align: center; }
        .sign-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 10px; color: #64748b; }
        .footer { text-align: center; font-size: 9.5px; color: #94a3b8; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company-name">${settings.storeName || 'Ferretería & Suministros'}</div>
          <div class="company-info">RUC: ${settings.taxId || '9999999999001'} | ${settings.legalName || ''}</div>
          <div class="company-info">Dirección: ${settings.address || 'Matriz'} | Tel: ${settings.phone || 'S/N'}</div>
          ${settings.email ? `<div class="company-info">Email: ${settings.email}</div>` : ''}
        </div>
        <div class="order-badge">
          <div class="order-title">Orden de Pedido</div>
          <div class="order-id">${order.id}</div>
          <div class="order-status">${order.status}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-col">
          <h4>Datos del Cliente</h4>
          <p><strong>Cliente:</strong> ${order.customerName}</p>
          <p><strong>RUC / C.I.:</strong> ${order.customerRuc || 'Consumidor Final'}</p>
          ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
        </div>
        <div class="info-col">
          <h4>Detalles del Pedido</h4>
          <p><strong>Fecha:</strong> ${formatFullDate(order.date)}</p>
          <p><strong>Entrega:</strong> ${order.deliveryAddress || 'En local / Retiro en tienda'}</p>
          <p><strong>Total Ítems:</strong> ${order.itemsCount || order.items.length} productos</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="text-align: left;">Descripción del Producto</th>
            <th style="width: 60px; text-align: center;">Cant.</th>
            <th style="width: 85px; text-align: right;">P. Unit</th>
            <th style="width: 95px; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals-container">
        <table class="totals-table">
          <tr>
            <td style="color: #475569; font-weight: 600;">Subtotal:</td>
            <td style="text-align: right; font-family: monospace; font-weight: bold; color: #1e293b;">${formatCurrency(order.subtotal, settings.currencySymbol)}</td>
          </tr>
          <tr>
            <td style="color: #475569; font-weight: 600;">IVA (${settings.defaultTaxRate || 15}%):</td>
            <td style="text-align: right; font-family: monospace; font-weight: bold; color: #1e293b;">${formatCurrency(order.tax, settings.currencySymbol)}</td>
          </tr>
          <tr class="total-row">
            <td>TOTAL:</td>
            <td style="text-align: right; font-family: monospace;">${formatCurrency(order.total, settings.currencySymbol)}</td>
          </tr>
        </table>
      </div>

      <div class="signatures">
        <div>
          <div style="height: 35px;"></div>
          <div class="sign-line">Firma Autorizada / Vendedor</div>
        </div>
        <div>
          <div style="height: 35px;"></div>
          <div class="sign-line">Recibí Conforme / Cliente</div>
        </div>
      </div>

      <div class="footer">
        ${settings.footerNotes || 'Documento no válido como factura tributaria. Comprobante interno de pedido.'}
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

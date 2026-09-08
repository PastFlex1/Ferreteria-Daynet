import jsPDF from 'jspdf';
import { StoreSettings } from '../types';
import { formatFullDate } from './formatters';

export interface PhysicalInventoryPdfItem {
  sku: string;
  barcode?: string;
  name: string;
  category?: string;
  location?: string;
  unit?: string;
  systemStock: number;
}

export interface PhysicalInventoryPdfOptions {
  categoryFilter?: string;
  auditorName?: string;
  notes?: string;
}

export const downloadTomaFisicaPdf = (
  items: PhysicalInventoryPdfItem[],
  settings: StoreSettings,
  options?: PhysicalInventoryPdfOptions
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 12;
  const rightMargin = 12;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 186mm

  let currentPage = 1;

  // Header renderer
  const renderHeader = (isFirstPage: boolean) => {
    let y = 10;

    // Top Dark Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, isFirstPage ? 32 : 18, 'F');

    // Accent line
    doc.setFillColor(249, 115, 22); // orange-500
    doc.rect(0, isFirstPage ? 32 : 18, pageWidth, 1.5, 'F');

    // Company Name
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 14 : 11);
    doc.text(settings.storeName || 'FERRETERÍA DAYNET895', leftMargin, isFirstPage ? y + 5 : y + 3);

    if (isFirstPage) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`RUC: ${settings.taxId || '1790000000001'}  |  ${settings.legalName || 'Ferretería & Suministros'}`, leftMargin, y + 10);
      doc.text(`Dirección: ${settings.address || 'Matriz Principal'}  |  Tel: ${settings.phone || 'S/N'}`, leftMargin, y + 14);
      doc.text(`CONTROL INTERNO DE AUDITORÍA Y TOMA FÍSICA DE MERCADERÍA`, leftMargin, y + 18);

      // Title on the right side
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(251, 146, 60); // orange-400
      doc.text('TOMA FÍSICA DE INVENTARIO', pageWidth - rightMargin, y + 6, { align: 'right' });
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('HOJA DE CONTEO EN PERCHA', pageWidth - rightMargin, y + 11, { align: 'right' });
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`TOTAL ÍTEMS: ${items.length}`, pageWidth - rightMargin, y + 16, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(251, 146, 60);
      doc.text('TOMA FÍSICA - HOJA DE CONTEO', pageWidth - rightMargin, y + 3, { align: 'right' });
    }

    let nextY = isFirstPage ? 38 : 23;

    // Metadata Box (First page only)
    if (isFirstPage) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(leftMargin, nextY, contentWidth, 22, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      // Left Column
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha de Auditoría:', leftMargin + 4, nextY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(formatFullDate(new Date().toISOString()), leftMargin + 32, nextY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Categoría / Sector:', leftMargin + 4, nextY + 11);
      doc.setFont('helvetica', 'normal');
      doc.text(options?.categoryFilter || 'Todas las Categorías del Catálogo', leftMargin + 32, nextY + 11);

      doc.setFont('helvetica', 'bold');
      doc.text('Almacén / Bodega:', leftMargin + 4, nextY + 16.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Almacén Principal & Tienda', leftMargin + 32, nextY + 16.5);

      // Right Column
      const midX = leftMargin + 105;
      doc.setFont('helvetica', 'bold');
      doc.text('Responsable del Conteo:', midX, nextY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(options?.auditorName || '__________________________________', midX + 38, nextY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Supervisor de Turno:', midX, nextY + 11);
      doc.setFont('helvetica', 'normal');
      doc.text('__________________________________', midX + 38, nextY + 11);

      doc.setFont('helvetica', 'bold');
      doc.text('Instrucción:', midX, nextY + 16.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(194, 65, 12); // orange-700
      doc.text('Anotar a mano en el recuadro blanco la cantidad física contada.', midX + 20, nextY + 16.5);

      nextY += 25;
    }

    // Render Table Header
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(leftMargin, nextY, contentWidth, 8, 1, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    // Columns:
    // 1. # (8mm)
    // 2. SKU / CÓDIGO (24mm)
    // 3. DESCRIPCIÓN PRODUCTO (54mm)
    // 4. UBICACIÓN / CATEGORÍA (26mm)
    // 5. UNID (10mm)
    // 6. STOCK SIST. (18mm)
    // 7. STOCK FÍSICO REAL (24mm) -> RECUADRO EN BLANCO
    // 8. OBSERVACIONES (22mm)
    let cx = leftMargin;
    doc.text('#', cx + 4, nextY + 5.5, { align: 'center' });
    cx += 8;

    doc.text('SKU / CÓDIGO', cx + 2, nextY + 5.5);
    cx += 24;

    doc.text('DESCRIPCIÓN DEL PRODUCTO', cx + 2, nextY + 5.5);
    cx += 54;

    doc.text('UBICACIÓN / CAT.', cx + 2, nextY + 5.5);
    cx += 26;

    doc.text('UNID', cx + 5, nextY + 5.5, { align: 'center' });
    cx += 10;

    doc.text('STK. SIST.', cx + 16, nextY + 5.5, { align: 'right' });
    cx += 18;

    // Highlight the Physical Count header
    doc.setFillColor(234, 88, 12); // orange-600
    doc.roundedRect(cx, nextY + 0.5, 24, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('CONTEO REAL', cx + 12, nextY + 5.2, { align: 'center' });
    cx += 24;

    doc.setTextColor(255, 255, 255);
    doc.text('OBSERVACIÓN', cx + 2, nextY + 5.5);

    return nextY + 8.5;
  };

  // Render Footer for current page
  const renderFooter = (page: number) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Planilla de Toma Física de Inventario  •  ${settings.storeName || 'Ferretería DAYNET895'}  •  Uso Exclusivo de Auditoría Interna`,
      leftMargin,
      pageHeight - 6
    );
    doc.text(`Página ${page}`, pageWidth - rightMargin, pageHeight - 6, { align: 'right' });
  };

  let currentY = renderHeader(true);
  const rowHeight = 7.5;

  items.forEach((item, index) => {
    // Check if new page is needed
    if (currentY + rowHeight > pageHeight - 16) {
      renderFooter(currentPage);
      doc.addPage();
      currentPage++;
      currentY = renderHeader(false);
    }

    // Alternating row background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(leftMargin, currentY, contentWidth, rowHeight, 'F');
    }

    // Bottom row separator
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.15);
    doc.line(leftMargin, currentY + rowHeight, leftMargin + contentWidth, currentY + rowHeight);

    let cx = leftMargin;

    // 1. Index
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(String(index + 1), cx + 4, currentY + 5, { align: 'center' });
    cx += 8;

    // 2. SKU
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const skuText = item.sku.length > 14 ? item.sku.substring(0, 13) + '..' : item.sku;
    doc.text(skuText, cx + 2, currentY + 5);
    cx += 24;

    // 3. Product Name
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const nameText = item.name.length > 34 ? item.name.substring(0, 32) + '...' : item.name;
    doc.text(nameText, cx + 2, currentY + 5);
    cx += 54;

    // 4. Location / Category
    const locText = item.location || item.category || 'General';
    const locTrunc = locText.length > 17 ? locText.substring(0, 15) + '..' : locText;
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(locTrunc, cx + 2, currentY + 5);
    cx += 26;

    // 5. Unit
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const unitText = (item.unit || 'u').substring(0, 4);
    doc.text(unitText, cx + 5, currentY + 5, { align: 'center' });
    cx += 10;

    // 6. System Stock
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(String(item.systemStock), cx + 16, currentY + 5, { align: 'right' });
    cx += 18;

    // 7. PHYSICAL COUNT BOX - COMPLETELY IN BLANK FOR MANUAL WRITING
    // Distinct crisp white box with visible border for pen writing
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(15, 23, 42); // slate-900 border
    doc.setLineWidth(0.35);
    doc.roundedRect(cx + 2, currentY + 0.9, 20, rowHeight - 1.8, 1, 1, 'FD');
    // Keep it 100% blank! No text printed inside this box.
    cx += 24;

    // 8. OBSERVATIONS - dotted / blank underline for writing notes
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.2);
    doc.line(cx + 2, currentY + rowHeight - 1.8, cx + 20, currentY + rowHeight - 1.8);

    currentY += rowHeight;
  });

  // Check if signatures fit on this page, otherwise add a new page
  if (currentY + 36 > pageHeight - 16) {
    renderFooter(currentPage);
    doc.addPage();
    currentPage++;
    currentY = renderHeader(false);
  }

  currentY += 8;

  // Signatures and Close Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftMargin, currentY, contentWidth, 26, 2, 2, 'FD');

  const signWidth = (contentWidth - 20) / 2;
  const sign1X = leftMargin + 7;
  const sign2X = leftMargin + signWidth + 13;

  // Signature 1: Contador / Auditor
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(sign1X, currentY + 16, sign1X + signWidth, currentY + 16);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Firma y Nombre del Auditor / Responsable Conteo', sign1X + signWidth / 2, currentY + 20, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('C.I.: ___________________  |  Hora Fin: _______', sign1X + signWidth / 2, currentY + 23.5, { align: 'center' });

  // Signature 2: Supervisor / Administrador
  doc.line(sign2X, currentY + 16, sign2X + signWidth, currentY + 16);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Firma y Visto Bueno del Supervisor / Administrador', sign2X + signWidth / 2, currentY + 20, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Fecha de Aprobación: _____ / _____ / 2026', sign2X + signWidth / 2, currentY + 23.5, { align: 'center' });

  // Final footer
  renderFooter(currentPage);

  // Generate file download
  const dateStr = new Date().toISOString().split('T')[0];
  const catSlug = options?.categoryFilter && options.categoryFilter !== 'TODAS'
    ? `_${options.categoryFilter.replace(/\s+/g, '_')}`
    : '';
  const fileName = `Planilla_Toma_Fisica_Inventario${catSlug}_${dateStr}.pdf`;

  doc.save(fileName);
};

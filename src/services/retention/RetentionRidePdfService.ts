/**
 * @fileOverview Generador del RIDE (Representación Impresa de Documento Electrónico)
 * oficial del SRI para Comprobantes de Retención (codDoc 07, versión ATS 2.0.0).
 * Genera el documento PDF cumpliendo con la estructura gráfica exigida por el SRI.
 */

import jsPDF from 'jspdf';
import { RetentionRecord } from '../../types/retention';
import { StoreSettings } from '../../types';
import { formatCurrency, formatFullDate } from '../../utils/formatters';

export class RetentionRidePdfService {
  /**
   * Genera el documento jsPDF con el formato oficial del RIDE de Comprobante de Retención.
   */
  public static createPdfDocument(retention: RetentionRecord, settings: StoreSettings): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 14;

    // ==========================================
    // 1. ENCABEZADO: BANNER INSTITUCIONAL
    // ==========================================
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 36, 'F');

    // Nombre Comercial / Razón Social
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(settings.legalName || settings.storeName || 'FERRETERÍA & SUMINISTROS', 15, y);

    // Datos Tributarios del Emisor
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // slate-300
    y += 5;
    doc.text(`RUC: ${settings.taxId || '0999999999001'}  |  ${settings.storeName || ''}`, 15, y);
    y += 4;
    doc.text(`Matriz: ${settings.address || 'Matriz'}  |  Teléfono: ${settings.phone || 'S/N'}`, 15, y);
    y += 4;

    const oblig = settings.accountingRequired ? 'SÍ' : 'NO';
    let regimenText = `OBLIGADO A LLEVAR CONTABILIDAD: ${oblig}`;
    if (settings.isRetentionAgent) {
      regimenText += `  |  AGENTE DE RETENCIÓN RES: ${settings.retentionAgentResolution || '1'}`;
    }
    if (settings.isRimpe) {
      regimenText += `  |  RÉGIMEN RIMPE`;
    }
    doc.text(regimenText, 15, y);

    // Título y Número del Comprobante a la Derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(249, 115, 22); // orange-500
    doc.text(`COMPROBANTE DE RETENCIÓN`, pageWidth - 15, 14, { align: 'right' });
    
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`No. ${retention.id || `${retention.estab}-${retention.ptoEmi}-${retention.secuencial}`}`, pageWidth - 15, 21, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const isAutorizado = retention.estado === 'AUTORIZADO';
    doc.setTextColor(isAutorizado ? 52 : 239, isAutorizado ? 211 : 68, isAutorizado ? 153 : 68);
    doc.text(`ESTADO SRI: ${retention.estado}`, pageWidth - 15, 27, { align: 'right' });

    y = 44;

    // ==========================================
    // 2. CAJA CLAVE DE ACCESO Y AUTORIZACIÓN SRI
    // ==========================================
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, pageWidth - 30, 24, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('NÚMERO DE AUTORIZACIÓN / CLAVE DE ACCESO (49 DÍGITOS):', 18, y + 5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const claveAcceso = retention.claveAcceso || retention.numeroAutorizacion || 'PENDIENTE';
    doc.text(claveAcceso, 18, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const ambienteStr = retention.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS';
    const fechaAutStr = retention.fechaAutorizacion ? formatFullDate(retention.fechaAutorizacion) : formatFullDate(retention.fechaEmision);
    doc.text(`AMBIENTE: ${ambienteStr}   |   EMISIÓN: NORMAL   |   FECHA DE AUTORIZACIÓN: ${fechaAutStr}`, 18, y + 18);

    y += 30;

    // ==========================================
    // 3. DATOS DEL SUJETO RETENIDO
    // ==========================================
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(15, y, pageWidth - 30, 26, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL SUJETO RETENIDO (PROVEEDOR):', 20, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Razón Social: ${retention.sujetoRetenido.razonSocial}`, 20, y + 12);
    doc.text(`Identificación (${retention.sujetoRetenido.tipoIdentificacion}): ${retention.sujetoRetenido.identificacion}`, 20, y + 17);
    doc.text(`Dirección: ${retention.sujetoRetenido.direccion || 'Matriz'}`, 20, y + 22);

    doc.text(`Fecha Emisión: ${retention.fechaEmision}`, pageWidth / 2 + 10, y + 12);
    doc.text(`Período Fiscal: ${retention.periodoFiscal}`, pageWidth / 2 + 10, y + 17);
    if (retention.sujetoRetenido.email) {
      doc.text(`Correo Electrónico: ${retention.sujetoRetenido.email}`, pageWidth / 2 + 10, y + 22);
    }

    y += 33;

    // ==========================================
    // 4. TABLA DE DOCUMENTOS DE SUSTENTO Y RETENCIONES
    // ==========================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DETALLE DE RETENCIONES APLICADAS', 15, y);
    y += 4;

    // Cabecera de la tabla
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, y, pageWidth - 30, 8, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    doc.text('Comprobante Sustento', 18, y + 5);
    doc.text('Fecha Sustento', 58, y + 5);
    doc.text('Impuesto', 82, y + 5);
    doc.text('Cód. Ret.', 108, y + 5);
    doc.text('Base Imponible', 128, y + 5);
    doc.text('% Ret.', 154, y + 5);
    doc.text('Valor Retenido', pageWidth - 18, y + 5, { align: 'right' });

    y += 8;

    // Filas de retención
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    let hasRows = false;
    for (const docSustento of retention.docsSustento) {
      const numSustento = docSustento.numDocSustento || '001001000000001';
      const formattedNumSustento = numSustento.length === 15 
        ? `${numSustento.substring(0, 3)}-${numSustento.substring(3, 6)}-${numSustento.substring(6)}`
        : numSustento;

      if (Array.isArray(docSustento.retenciones)) {
        for (const ret of docSustento.retenciones) {
          hasRows = true;
          // Fondo alternado
          doc.setFillColor(255, 255, 255);
          doc.rect(15, y, pageWidth - 30, 7, 'F');
          doc.line(15, y + 7, pageWidth - 15, y + 7);

          const taxName = ret.codigo === '1' ? 'RENTA' : ret.codigo === '2' ? 'IVA' : 'ISD';

          doc.text(`FACTURA ${formattedNumSustento}`, 18, y + 4.5);
          doc.text(docSustento.fechaEmisionDocSustento || retention.fechaEmision, 58, y + 4.5);
          doc.text(taxName, 82, y + 4.5);
          doc.text(ret.codigoRetencion || '-', 108, y + 4.5);
          doc.text(`$${ret.baseImponible.toFixed(2)}`, 128, y + 4.5);
          doc.text(`${ret.porcentajeRetener.toFixed(2)}%`, 154, y + 4.5);
          doc.text(`$${ret.valorRetenido.toFixed(2)}`, pageWidth - 18, y + 4.5, { align: 'right' });

          y += 7;
        }
      }
    }

    if (!hasRows) {
      doc.rect(15, y, pageWidth - 30, 8, 'F');
      doc.text('No hay líneas de retención registradas.', 18, y + 5);
      y += 8;
    }

    y += 5;

    // ==========================================
    // 5. CAJA DE TOTALES
    // ==========================================
    const totalBoxX = pageWidth - 90;
    const totalBoxWidth = 75;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(totalBoxX, y, totalBoxWidth, 32, 2, 2, 'FD');

    let totY = y + 6;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('SUBTOTAL RETENCIÓN RIR:', totalBoxX + 4, totY);
    doc.text(`$${retention.totalRetenidoRenta.toFixed(2)}`, totalBoxX + totalBoxWidth - 4, totY, { align: 'right' });

    totY += 6;
    doc.text('SUBTOTAL RETENCIÓN IVA:', totalBoxX + 4, totY);
    doc.text(`$${retention.totalRetenidoIva.toFixed(2)}`, totalBoxX + totalBoxWidth - 4, totY, { align: 'right' });

    totY += 6;
    doc.text('SUBTOTAL RETENCIÓN ISD:', totalBoxX + 4, totY);
    doc.text(`$${retention.totalRetenidoIsd.toFixed(2)}`, totalBoxX + totalBoxWidth - 4, totY, { align: 'right' });

    totY += 7;
    doc.setFillColor(226, 232, 240);
    doc.rect(totalBoxX + 2, totY - 4, totalBoxWidth - 4, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL RETENIDO:', totalBoxX + 4, totY + 1);
    doc.text(`$${retention.totalRetenido.toFixed(2)}`, totalBoxX + totalBoxWidth - 4, totY + 1, { align: 'right' });

    // ==========================================
    // 6. INFORMACIÓN ADICIONAL / PIE DE PÁGINA
    // ==========================================
    const infoBoxWidth = totalBoxX - 25;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, infoBoxWidth, 32, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('INFORMACIÓN ADICIONAL:', 18, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`Email Emisor: ${settings.email || 'N/A'}`, 18, y + 12);
    doc.text(`Validez Legal: Documento emitido conforme al esquema Off-line v2.34 del SRI.`, 18, y + 17);
    doc.text(`La fuente tributaria primaria legal es el XML autorizado por el SRI.`, 18, y + 22);

    const providerRuc = localStorage.getItem('ferreteria_sri_provider_ruc');
    if (providerRuc) {
      doc.text(`RUC Proveedor del Sistema: ${providerRuc}`, 18, y + 27);
    }

    return doc;
  }

  /**
   * Descarga directamente el archivo PDF del RIDE en el navegador.
   */
  public static downloadPdf(retention: RetentionRecord, settings: StoreSettings): void {
    const doc = this.createPdfDocument(retention, settings);
    const fileName = `RIDE_Retencion_${retention.id || retention.secuencial}.pdf`;
    doc.save(fileName);
  }

  /**
   * Retorna el Blob del PDF generado para envío por correo o previsualización.
   */
  public static getPdfBlob(retention: RetentionRecord, settings: StoreSettings): Blob {
    const doc = this.createPdfDocument(retention, settings);
    return doc.output('blob');
  }
}

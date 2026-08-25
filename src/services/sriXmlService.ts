/**
 * @fileOverview Servicio para la generación de XML de Facturas y Notas de Crédito bajo el estándar oficial del SRI (Ecuador).
 * Implementa la Clave de Acceso de 49 dígitos con el algoritmo oficial Módulo 11.
 */

import { StoreSettings, CartItem, Invoice, PaymentMethod } from '../types';

export interface SRIInvoiceData {
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor?: string;
  dirMatriz: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  fechaEmision: string; // Formato DD/MM/YYYY
  ambiente: '1' | '2'; // 1 = PRUEBAS, 2 = PRODUCCION
  cliente: {
    razonSocial: string;
    identificacion: string;
    direccion?: string;
    email?: string;
    telefono?: string;
  };
  items: Array<{
    codigo?: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento?: number;
    ivaRate?: string | number;
  }>;
  formaPago: string; // "01" Efectivo, "20" Otros con Sist. Financiero, "19" Tarjeta Crédito, "16" Tarjeta Débito
  tipoComprobante?: string; // "01" Factura, "04" Nota de Crédito
  facturaModificada?: {
    numero: string;
    fecha: string;
  };
  observaciones?: string;
  transferNumber?: string;
  regimen?: string;
  obligadoContabilidad?: string;
}

const safe = (n: any) => Number(n || 0);

/**
 * Algoritmo Módulo 11 oficial del SRI para el dígito verificador.
 */
export function modulo11(cadena: string): number {
  let suma = 0;
  let factor = 2;
  for (let i = cadena.length - 1; i >= 0; i--) {
    suma += parseInt(cadena.charAt(i), 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const residuo = suma % 11;
  const digito = 11 - residuo;
  if (digito === 11) return 0;
  if (digito === 10) return 1;
  return digito;
}

/**
 * Mapea las tarifas de IVA locales a los códigos de porcentaje requeridos por el SRI.
 */
export function getIvaMapping(ivaRate: string | number | undefined) {
  const rateNum = typeof ivaRate === 'number' ? ivaRate : parseFloat(String(ivaRate || '0').replace('%', ''));
  
  if (rateNum === 15) {
    return { codigoPorcentaje: '4', tarifa: '15.00', multiplier: 0.15 };
  } else if (rateNum === 12) {
    return { codigoPorcentaje: '2', tarifa: '12.00', multiplier: 0.12 };
  } else if (rateNum === 5) {
    return { codigoPorcentaje: '5', tarifa: '5.00', multiplier: 0.05 };
  } else if (rateNum === 0) {
    return { codigoPorcentaje: '0', tarifa: '0.00', multiplier: 0 };
  }
  return { codigoPorcentaje: '4', tarifa: '15.00', multiplier: 0.15 };
}

/**
 * Mapea la forma de pago local al código SRI.
 */
export function getSriPaymentCode(method: PaymentMethod | string): string {
  switch (method) {
    case 'EFECTIVO':
      return '01'; // Sin utilización del sistema financiero
    case 'TARJETA_CREDITO':
      return '19'; // Tarjeta de Crédito
    case 'TARJETA_DEBITO':
      return '16'; // Tarjeta de Débito
    case 'TRANSFERENCIA':
      return '20'; // Otros con utilización del sistema financiero
    case 'CREDITO':
      return '20';
    default:
      return '01';
  }
}

/**
 * Genera la clave de acceso de 49 dígitos basada en la tabla de 9 campos del SRI.
 */
export function generateAccessKey(data: SRIInvoiceData): string {
  const dateParts = data.fechaEmision.split('/');
  const dateStr = dateParts.length === 3 ? `${dateParts[0]}${dateParts[1]}${dateParts[2]}` : data.fechaEmision.replace(/\//g, '').replace(/-/g, '');
  const codDoc = data.tipoComprobante || '01'; 
  const ruc = (data.rucEmisor || '1790012345001').padStart(13, '0');
  const ambiente = data.ambiente || '1'; 
  const serie = (data.estab || '001').padStart(3, '0') + (data.ptoEmi || '001').padStart(3, '0');
  const secuencial = (data.secuencial || '1').padStart(9, '0');
  const codigoNumerico = '12345678'; 
  const tipoEmision = '1';

  const baseKey = dateStr + codDoc + ruc + ambiente + serie + secuencial + codigoNumerico + tipoEmision;
  const dv = modulo11(baseKey);
  
  return baseKey + dv.toString();
}

/**
 * Genera el string XML estructurado para Facturas Electrónicas SRI v1.1.0 sin firmar.
 */
export function generateInvoiceXML(data: SRIInvoiceData): { xml: string; claveAcceso: string } {
  const claveAcceso = generateAccessKey(data);
  
  // Tax grouping and calculations
  const taxGroups: { [key: string]: { base: number; valor: number; codigoPorcentaje: string; tarifa: string } } = {};
  
  (data.items || []).forEach(i => {
    const mapping = getIvaMapping(i.ivaRate);
    const key = `${mapping.codigoPorcentaje}`;
    const totalLine = safe(i.cantidad) * safe(i.precioUnitario);
    const discount = safe(i.descuento);
    const netLine = Math.max(0, totalLine - discount);
    
    const baseVal = netLine;
    const taxVal = netLine * mapping.multiplier;
    
    if (!taxGroups[key]) {
      taxGroups[key] = { base: 0, valor: 0, codigoPorcentaje: mapping.codigoPorcentaje, tarifa: mapping.tarifa };
    }
    taxGroups[key].base += baseVal;
    taxGroups[key].valor += taxVal;
  });

  const subtotalTotal = Object.values(taxGroups).reduce((acc, g) => acc + g.base, 0);
  const valorIVA = Object.values(taxGroups).reduce((acc, g) => acc + g.valor, 0);
  const totalConImpuestosCalculado = subtotalTotal + valorIVA;

  let tipoId = '05'; // Cédula por defecto
  const idStr = (data.cliente.identificacion || '').trim();

  if (idStr === '9999999999999' || data.cliente.razonSocial?.toUpperCase().includes('CONSUMIDOR FINAL')) {
    tipoId = '07'; // Consumidor Final
  } else if (idStr.length === 13) {
    tipoId = '04'; // RUC
  } else if (idStr.length === 10) {
    tipoId = '05'; // Cédula
  } else {
    tipoId = '06'; // Pasaporte
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<factura id="comprobante" version="1.1.0">\n\n`;
  
  xml += `    <infoTributaria>\n`;
  xml += `        <ambiente>${data.ambiente || '1'}</ambiente>\n`;
  xml += `        <tipoEmision>1</tipoEmision>\n`;
  xml += `        <razonSocial>${escapeXml(data.razonSocialEmisor)}</razonSocial>\n`;
  xml += `        <nombreComercial>${escapeXml(data.nombreComercialEmisor || data.razonSocialEmisor)}</nombreComercial>\n`;
  xml += `        <ruc>${data.rucEmisor}</ruc>\n`;
  xml += `        <claveAcceso>${claveAcceso}</claveAcceso>\n`;
  xml += `        <codDoc>01</codDoc>\n`;
  xml += `        <estab>${data.estab.padStart(3, '0')}</estab>\n`;
  xml += `        <ptoEmi>${data.ptoEmi.padStart(3, '0')}</ptoEmi>\n`;
  xml += `        <secuencial>${data.secuencial.padStart(9, '0')}</secuencial>\n`;
  xml += `        <dirMatriz>${escapeXml(data.dirMatriz || 'Ecuador')}</dirMatriz>\n`;
  xml += `    </infoTributaria>\n\n`;

  xml += `    <infoFactura>\n`;
  xml += `        <fechaEmision>${data.fechaEmision}</fechaEmision>\n`;
  xml += `        <dirEstablecimiento>${escapeXml(data.dirMatriz || 'Ecuador')}</dirEstablecimiento>\n`;
  xml += `        <obligadoContabilidad>${data.obligadoContabilidad || 'NO'}</obligadoContabilidad>\n`;
  xml += `        <tipoIdentificacionComprador>${tipoId}</tipoIdentificacionComprador>\n`;
  xml += `        <razonSocialComprador>${escapeXml(data.cliente.razonSocial || 'CONSUMIDOR FINAL')}</razonSocialComprador>\n`;
  xml += `        <identificacionComprador>${data.cliente.identificacion || '9999999999999'}</identificacionComprador>\n`;
  xml += `        <direccionComprador>${escapeXml(data.cliente.direccion || 'S/N')}</direccionComprador>\n`;
  xml += `        <totalSinImpuestos>${safe(subtotalTotal).toFixed(2)}</totalSinImpuestos>\n`;
  xml += `        <totalDescuento>0.00</totalDescuento>\n\n`;

  xml += `        <totalConImpuestos>\n`;
  Object.values(taxGroups).forEach(group => {
    xml += `            <totalImpuesto>\n`;
    xml += `                <codigo>2</codigo>\n`; 
    xml += `                <codigoPorcentaje>${group.codigoPorcentaje}</codigoPorcentaje>\n`; 
    xml += `                <baseImponible>${group.base.toFixed(2)}</baseImponible>\n`;
    xml += `                <valor>${group.valor.toFixed(2)}</valor>\n`;
    xml += `            </totalImpuesto>\n`;
  });
  xml += `        </totalConImpuestos>\n\n`;

  xml += `        <propina>0.00</propina>\n`;
  xml += `        <importeTotal>${safe(totalConImpuestosCalculado).toFixed(2)}</importeTotal>\n`;
  xml += `        <moneda>DOLAR</moneda>\n`;

  xml += `\n        <pagos>\n`;
  xml += `            <pago>\n`;
  xml += `                <formaPago>${data.formaPago || '01'}</formaPago>\n`;
  xml += `                <total>${safe(totalConImpuestosCalculado).toFixed(2)}</total>\n`;
  xml += `            </pago>\n`;
  xml += `        </pagos>\n`;

  xml += `    </infoFactura>\n\n`;

  xml += `    <detalles>\n`;
  (data.items || []).forEach((item, index) => {
    const totalLine = safe(item.cantidad) * safe(item.precioUnitario);
    const discount = safe(item.descuento);
    const baseVal = Math.max(0, totalLine - discount);
    const mapping = getIvaMapping(item.ivaRate);
    const taxVal = baseVal * mapping.multiplier;
    const unitPrice = safe(item.precioUnitario);
    
    xml += `        <detalle>\n`;
    xml += `            <codigoPrincipal>${escapeXml(item.codigo || (index + 1).toString().padStart(3, '0'))}</codigoPrincipal>\n`;
    xml += `            <descripcion>${escapeXml(item.descripcion)}</descripcion>\n`;
    xml += `            <cantidad>${safe(item.cantidad).toFixed(2)}</cantidad>\n`;
    xml += `            <precioUnitario>${unitPrice.toFixed(4)}</precioUnitario>\n`;
    xml += `            <descuento>${discount.toFixed(2)}</descuento>\n`;
    xml += `            <precioTotalSinImpuesto>${safe(baseVal).toFixed(2)}</precioTotalSinImpuesto>\n\n`;
    xml += `            <impuestos>\n`;
    xml += `                <impuesto>\n`;
    xml += `                    <codigo>2</codigo>\n`; 
    xml += `                    <codigoPorcentaje>${mapping.codigoPorcentaje}</codigoPorcentaje>\n`; 
    xml += `                    <tarifa>${mapping.tarifa}</tarifa>\n`; 
    xml += `                    <baseImponible>${safe(baseVal).toFixed(2)}</baseImponible>\n`;
    xml += `                    <valor>${safe(taxVal).toFixed(2)}</valor>\n`;
    xml += `                </impuesto>\n`;
    xml += `            </impuestos>\n\n`;
    xml += `        </detalle>\n`;
  });
  xml += `    </detalles>\n\n`;

  const additionalFields: Array<{ name: string; value: string }> = [];
  if (data.regimen && data.regimen.toUpperCase().includes('RIMPE')) {
    additionalFields.push({ name: 'contribuyenteRimpe', value: 'CONTRIBUYENTE RÉGIMEN RIMPE' });
  }
  if (data.cliente.email) additionalFields.push({ name: 'email', value: data.cliente.email });
  if (data.cliente.telefono) additionalFields.push({ name: 'telefono', value: data.cliente.telefono });
  if (data.observaciones) additionalFields.push({ name: 'observaciones', value: data.observaciones });
  if (data.transferNumber) additionalFields.push({ name: 'comprobante', value: data.transferNumber });

  if (additionalFields.length > 0) {
    xml += `    <infoAdicional>\n`;
    additionalFields.forEach(field => {
      xml += `        <campoAdicional nombre="${escapeXml(field.name)}">${escapeXml(field.value)}</campoAdicional>\n`;
    });
    xml += `    </infoAdicional>\n\n`;
  }

  xml += `</factura>`;
  return { xml, claveAcceso };
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convierte un objeto Invoice del ERP a la estructura de datos SRI.
 */
export function convertERPInvoiceToSRI(
  invoice: Invoice,
  settings: StoreSettings,
  establishment: string = '001',
  emissionPoint: string = '001',
  ambiente: '1' | '2' = '2'
): SRIInvoiceData {
  const now = new Date(invoice.createdAt || Date.now());
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const fechaEmision = `${day}/${month}/${year}`;

  return {
    rucEmisor: settings.taxId || (settings as any).ruc || '1790012345001',
    razonSocialEmisor: settings.legalName || settings.storeName || 'FERRETERÍA DAYNET',
    nombreComercialEmisor: settings.storeName || 'FERRETERÍA DAYNET',
    dirMatriz: settings.address || 'Quito, Ecuador',
    estab: establishment || '001',
    ptoEmi: emissionPoint || '001',
    secuencial: String(invoice.number || '1').padStart(9, '0'),
    fechaEmision,
    ambiente,
    cliente: {
      razonSocial: invoice.customer?.name || 'CONSUMIDOR FINAL',
      identificacion: invoice.customer?.docNumber || (invoice.customer as any)?.identification || '9999999999999',
      direccion: invoice.customer?.address || 'S/N',
      email: invoice.customer?.email || '',
      telefono: invoice.customer?.phone || '',
    },
    items: invoice.items.map(item => ({
      codigo: item.sku || '0101',
      descripcion: item.productName,
      cantidad: item.quantity,
      precioUnitario: item.unitPrice,
      descuento: (item.unitPrice * item.quantity * (item.discountPercent || 0)) / 100,
      ivaRate: item.taxRate ?? 15,
    })),
    formaPago: getSriPaymentCode(invoice.paymentMethod),
    tipoComprobante: '01',
    observaciones: invoice.notes,
    obligadoContabilidad: 'NO',
  };
}

/**
 * Descarga el XML generado en el navegador del usuario.
 */
export function downloadXML(xmlString: string, filename: string) {
  const blob = new Blob([xmlString], { type: 'text/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

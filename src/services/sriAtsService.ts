/**
 * @fileOverview Servicio especializado para la generación del Anexo Transaccional Simplificado (ATS)
 * bajo el esquema oficial XML del Servicio de Rentas Internas (SRI) del Ecuador.
 */

import { Invoice, StoreSettings } from '../types';
import { PurchaseInvoice } from '../components/Purchases/PurchasesManager';
import { getSriPaymentCode } from './sriXmlService';
import { SriBackendService } from './sriBackendService';

export function escapeXml(unsafe: any): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface GenerateAtsOptions {
  mes: string; // '01' a '12'
  anio: string; // ej: '2026'
  settings: StoreSettings;
  invoices: Invoice[];
  purchases: PurchaseInvoice[];
  establishment?: string;
  useBackendIfAvailable?: boolean;
}

export interface AtsStats {
  periodo: string;
  totalVentas: number;
  totalCompras: number;
  cantidadVentas: number;
  cantidadCompras: number;
  cantidadAnulados: number;
  totalIvaVentas: number;
  totalIvaCompras: number;
}

export interface GenerateAtsResult {
  success: boolean;
  xml: string;
  filename: string;
  stats: AtsStats;
  message: string;
  source: 'LOCAL' | 'BACKEND';
}

/**
 * Determina el tipo de identificación del cliente según la ficha técnica ATS del SRI:
 * '04': RUC
 * '05': Cédula
 * '06': Pasaporte
 * '07': Consumidor Final
 */
export function getAtsTipoIdCliente(docNumber: string, name?: string): string {
  const doc = (docNumber || '').trim();
  const nom = (name || '').toUpperCase();

  if (doc === '9999999999999' || nom.includes('CONSUMIDOR FINAL')) {
    return '07';
  }
  if (doc.length === 13) {
    return '04';
  }
  if (doc.length === 10) {
    return '05';
  }
  return '06';
}

/**
 * Determina el tipo de identificación del proveedor para ATS:
 * '01': RUC
 * '02': Cédula
 * '03': Pasaporte
 */
export function getAtsTipoIdProveedor(taxId: string): string {
  const doc = (taxId || '').trim();
  if (doc.length === 13) return '01';
  if (doc.length === 10) return '02';
  return '03';
}

/**
 * Formatea una fecha a DD/MM/YYYY para el ATS del SRI.
 */
export function formatAtsDate(dateInput: string | Date | undefined): string {
  if (!dateInput) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      // Si ya viene en formato YYYY-MM-DD
      const parts = String(dateInput).split('-');
      if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
      return '01/01/2026';
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '01/01/2026';
  }
}

/**
 * Desglosa serie de factura proveedor (ej: '001-002-00004589' -> estab='001', pto='002', sec='000004589').
 */
export function parseInvoiceNumber(numStr: string | undefined): { estab: string; ptoEmi: string; secuencial: string } {
  const str = (numStr || '').trim();
  const parts = str.split('-');
  if (parts.length === 3) {
    return {
      estab: parts[0].padStart(3, '0').slice(-3),
      ptoEmi: parts[1].padStart(3, '0').slice(-3),
      secuencial: parts[2].replace(/\D/g, '').padStart(9, '0').slice(-9)
    };
  }
  return {
    estab: '001',
    ptoEmi: '001',
    secuencial: str.replace(/\D/g, '').padStart(9, '0').slice(-9) || '000000001'
  };
}

/**
 * Generador principal del archivo ATS SRI XML
 */
export async function generateAtsXml(options: GenerateAtsOptions): Promise<GenerateAtsResult> {
  const {
    mes,
    anio,
    settings,
    invoices,
    purchases,
    establishment = '001',
    useBackendIfAvailable = true
  } = options;

  const rucInformante = settings.taxId || (settings as any).ruc || '1790012345001';
  const razonSocial = settings.legalName || settings.storeName || 'FERRETERÍA CENTRAL';
  const tipoIdInformante = rucInformante.length === 13 ? 'R' : 'C';

  // 1. Filtrar ventas del periodo (excluyendo cotizaciones)
  const ventasPeriodo = invoices.filter(inv => {
    if (inv.documentType === 'COTIZACION') return false;
    const d = new Date(inv.createdAt);
    if (isNaN(d.getTime())) return false;
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return y === anio && m === mes;
  });

  const ventasValidas = ventasPeriodo.filter(inv => inv.paymentStatus !== 'ANULADA');
  const facturasAnuladas = ventasPeriodo.filter(inv => inv.paymentStatus === 'ANULADA');

  // 2. Filtrar compras del periodo
  const comprasPeriodo = purchases.filter(pur => {
    const d = new Date(pur.purchaseDate || (pur as any).createdAt);
    if (isNaN(d.getTime())) return false;
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return y === anio && m === mes;
  });

  // 3. Métricas y estadísticas
  const totalVentasBruto = ventasValidas.reduce((acc, v) => acc + (v.total || 0), 0);
  const totalIvaVentas = ventasValidas.reduce((acc, v) => acc + (v.taxTotal || 0), 0);
  const totalVentasSinImpuestos = ventasValidas.reduce((acc, v) => acc + (v.subtotal || 0), 0);

  const totalComprasBruto = comprasPeriodo.reduce((acc, c) => acc + (c.total || 0), 0);
  const totalIvaCompras = comprasPeriodo.reduce((acc, c) => acc + (c.taxTotal || 0), 0);

  const stats: AtsStats = {
    periodo: `${mes}/${anio}`,
    totalVentas: totalVentasBruto,
    totalCompras: totalComprasBruto,
    cantidadVentas: ventasValidas.length,
    cantidadCompras: comprasPeriodo.length,
    cantidadAnulados: facturasAnuladas.length,
    totalIvaVentas,
    totalIvaCompras
  };

  const filename = `ATS_${rucInformante}_${mes}_${anio}.xml`;

  // Si se solicita intentar el backend Spring Boot primero
  if (useBackendIfAvailable) {
    try {
      const backendRes = await SriBackendService.generarAts({
        mes,
        anio,
        rucInformante,
        razonSocial,
        numEstabRuc: establishment,
        compras: comprasPeriodo,
        ventas: ventasValidas,
        anulados: facturasAnuladas
      });

      if (backendRes && backendRes.estado === 'OK' && backendRes.contenido) {
        return {
          success: true,
          xml: backendRes.contenido,
          filename,
          stats,
          message: 'XML ATS generado exitosamente desde el microservicio SRI.',
          source: 'BACKEND'
        };
      }
    } catch {
      // Continuar con la generación nativa local garantizada
    }
  }

  // 4. Generación nativa y conforme a la ficha técnica oficial del SRI Ecuador
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  xml += `<iva>\n`;
  xml += `  <TipoIDInformante>${tipoIdInformante}</TipoIDInformante>\n`;
  xml += `  <IdInformante>${rucInformante}</IdInformante>\n`;
  xml += `  <razonSocial>${escapeXml(razonSocial)}</razonSocial>\n`;
  xml += `  <Anio>${anio}</Anio>\n`;
  xml += `  <Mes>${mes}</Mes>\n`;
  xml += `  <numEstabRuc>${establishment.padStart(3, '0')}</numEstabRuc>\n`;
  xml += `  <totalVentas>${totalVentasSinImpuestos.toFixed(2)}</totalVentas>\n`;
  xml += `  <codigoOperativo>IVA</codigoOperativo>\n`;

  // SECCIÓN: COMPRAS
  if (comprasPeriodo.length > 0) {
    xml += `  <compras>\n`;
    comprasPeriodo.forEach(comp => {
      const parsedNum = parseInvoiceNumber(comp.invoiceNumber);
      const provDoc = comp.supplier?.taxId || '9999999999999';
      const tpIdProv = getAtsTipoIdProveedor(provDoc);
      const fechaReg = formatAtsDate(comp.purchaseDate);
      const fechaEmi = formatAtsDate(comp.purchaseDate);
      
      // Separar bases imponible 0% y gravada
      let base0 = 0;
      let baseGrav = 0;
      let montoIva = comp.taxTotal || 0;

      if (comp.items && comp.items.length > 0) {
        comp.items.forEach((item: any) => {
          if ((item.taxPercent || 0) > 0) {
            baseGrav += (item.subtotal || (item.quantity * item.costPrice) || 0);
          } else {
            base0 += (item.subtotal || (item.quantity * item.costPrice) || 0);
          }
        });
      } else {
        if (montoIva > 0) {
          baseGrav = comp.subtotal || 0;
        } else {
          base0 = comp.subtotal || 0;
        }
      }

      xml += `    <detalleCompras>\n`;
      xml += `      <codSustento>01</codSustento>\n`; // 01 = Crédito tributario para declaración de IVA
      xml += `      <tpIdProv>${tpIdProv}</tpIdProv>\n`;
      xml += `      <idProv>${provDoc}</idProv>\n`;
      xml += `      <tipoComprobante>01</tipoComprobante>\n`; // Factura
      xml += `      <parteRel>NO</parteRel>\n`;
      xml += `      <fechaRegistro>${fechaReg}</fechaRegistro>\n`;
      xml += `      <establecimiento>${parsedNum.estab}</establecimiento>\n`;
      xml += `      <puntoEmision>${parsedNum.ptoEmi}</puntoEmision>\n`;
      xml += `      <secuencial>${parsedNum.secuencial}</secuencial>\n`;
      xml += `      <fechaEmision>${fechaEmi}</fechaEmision>\n`;
      xml += `      <autorizacion>${provDoc.padEnd(10, '0')}</autorizacion>\n`;
      xml += `      <baseNoGraIva>0.00</baseNoGraIva>\n`;
      xml += `      <baseImponible>${base0.toFixed(2)}</baseImponible>\n`;
      xml += `      <baseImpGrav>${baseGrav.toFixed(2)}</baseImpGrav>\n`;
      xml += `      <baseImpExe>0.00</baseImpExe>\n`;
      xml += `      <montoIce>0.00</montoIce>\n`;
      xml += `      <montoIva>${montoIva.toFixed(2)}</montoIva>\n`;
      xml += `      <valRetBien10>0.00</valRetBien10>\n`;
      xml += `      <valRetServ20>0.00</valRetServ20>\n`;
      xml += `      <valorRetBienes>0.00</valorRetBienes>\n`;
      xml += `      <valRetServ50>0.00</valRetServ50>\n`;
      xml += `      <valorRetServicios>0.00</valorRetServicios>\n`;
      xml += `      <valRetServ100>0.00</valRetServ100>\n`;
      xml += `      <totbasesImpReemb>0.00</totbasesImpReemb>\n`;
      xml += `      <pagoExterior>\n`;
      xml += `        <pagoLocExt>01</pagoLocExt>\n`;
      xml += `        <paisEfecPago>NA</paisEfecPago>\n`;
      xml += `        <aplicConvDobTrib>NA</aplicConvDobTrib>\n`;
      xml += `        <pagExtSujRetNorLeg>NA</pagExtSujRetNorLeg>\n`;
      xml += `      </pagoExterior>\n`;
      xml += `      <formasDePago>\n`;
      xml += `        <formaPago>01</formaPago>\n`;
      xml += `      </formasDePago>\n`;
      xml += `    </detalleCompras>\n`;
    });
    xml += `  </compras>\n`;
  } else {
    xml += `  <compras/>\n`;
  }

  // SECCIÓN: VENTAS (Agrupadas por cliente para el ATS SRI)
  if (ventasValidas.length > 0) {
    // Agrupar ventas por identificación de cliente
    const ventasPorCliente: { [key: string]: {
      tpIdCliente: string;
      idCliente: string;
      nombreCliente: string;
      count: number;
      base0: number;
      baseGrav: number;
      montoIva: number;
      formaPago: string;
    } } = {};

    ventasValidas.forEach(inv => {
      const idCliente = inv.customer?.docNumber || (inv.customer as any)?.identification || '9999999999999';
      const nombreCliente = inv.customer?.name || 'CONSUMIDOR FINAL';
      const tpIdCliente = getAtsTipoIdCliente(idCliente, nombreCliente);
      const formaPago = getSriPaymentCode(inv.paymentMethod);

      const key = `${idCliente}_${formaPago}`;
      if (!ventasPorCliente[key]) {
        ventasPorCliente[key] = {
          tpIdCliente,
          idCliente,
          nombreCliente,
          count: 0,
          base0: 0,
          baseGrav: 0,
          montoIva: 0,
          formaPago
        };
      }

      ventasPorCliente[key].count += 1;
      
      // Separar bases imponibles de los items
      let invBase0 = 0;
      let invBaseGrav = 0;
      (inv.items || []).forEach(item => {
        const itemTax = Number(item.taxRate ?? 15);
        const itemSubtotal = (item.quantity * item.unitPrice) - ((item.quantity * item.unitPrice * (item.discountPercent || 0)) / 100);
        if (itemTax === 0) {
          invBase0 += itemSubtotal;
        } else {
          invBaseGrav += itemSubtotal;
        }
      });

      // Si no hubo desglose detallado de items, inferir del taxTotal
      if (invBase0 === 0 && invBaseGrav === 0) {
        if ((inv.taxTotal || 0) > 0) {
          invBaseGrav = inv.subtotal || 0;
        } else {
          invBase0 = inv.subtotal || 0;
        }
      }

      ventasPorCliente[key].base0 += invBase0;
      ventasPorCliente[key].baseGrav += invBaseGrav;
      ventasPorCliente[key].montoIva += (inv.taxTotal || 0);
    });

    xml += `  <ventas>\n`;
    Object.values(ventasPorCliente).forEach(v => {
      xml += `    <detalleVentas>\n`;
      xml += `      <tpIdCliente>${v.tpIdCliente}</tpIdCliente>\n`;
      xml += `      <idCliente>${v.idCliente}</idCliente>\n`;
      xml += `      <parteRelVtas>NO</parteRelVtas>\n`;
      xml += `      <tipoComprobante>18</tipoComprobante>\n`; // 18 = Comprobante de Venta Electrónico / Autorizado
      xml += `      <tipoEmision>E</tipoEmision>\n`;
      xml += `      <numeroComprobantes>${v.count}</numeroComprobantes>\n`;
      xml += `      <baseNoGraIva>0.00</baseNoGraIva>\n`;
      xml += `      <baseImponible>${v.base0.toFixed(2)}</baseImponible>\n`;
      xml += `      <baseImpGrav>${v.baseGrav.toFixed(2)}</baseImpGrav>\n`;
      xml += `      <montoIva>${v.montoIva.toFixed(2)}</montoIva>\n`;
      xml += `      <montoIce>0.00</montoIce>\n`;
      xml += `      <valorRetIva>0.00</valorRetIva>\n`;
      xml += `      <valorRetRenta>0.00</valorRetRenta>\n`;
      xml += `      <formasDePago>\n`;
      xml += `        <formaPago>${v.formaPago}</formaPago>\n`;
      xml += `      </formasDePago>\n`;
      xml += `    </detalleVentas>\n`;
    });
    xml += `  </ventas>\n`;
  } else {
    xml += `  <ventas/>\n`;
  }

  // SECCIÓN: VENTAS POR ESTABLECIMIENTO
  xml += `  <ventasEstablecimiento>\n`;
  xml += `    <ventaEst>\n`;
  xml += `      <codEstab>${establishment.padStart(3, '0')}</codEstab>\n`;
  xml += `      <ventasEstab>${totalVentasSinImpuestos.toFixed(2)}</ventasEstab>\n`;
  xml += `      <ivaComp>0.00</ivaComp>\n`;
  xml += `    </ventaEst>\n`;
  xml += `  </ventasEstablecimiento>\n`;

  // SECCIÓN: COMPROBANTES ANULADOS
  if (facturasAnuladas.length > 0) {
    xml += `  <anulados>\n`;
    facturasAnuladas.forEach(anul => {
      const parsed = parseInvoiceNumber(anul.fullNumber || `${anul.series || '001'}-${anul.number || 1}`);
      const auth = anul.sriNumeroAutorizacion || anul.sriClaveAcceso || '9999999999999999999999999999999999999999999999999';
      xml += `    <detalleAnulados>\n`;
      xml += `      <tipoComprobante>01</tipoComprobante>\n`; // Factura
      xml += `      <establecimiento>${parsed.estab}</establecimiento>\n`;
      xml += `      <puntoEmision>${parsed.ptoEmi}</puntoEmision>\n`;
      xml += `      <secuencialInicio>${parsed.secuencial}</secuencialInicio>\n`;
      xml += `      <secuencialFin>${parsed.secuencial}</secuencialFin>\n`;
      xml += `      <autorizacion>${auth}</autorizacion>\n`;
      xml += `    </detalleAnulados>\n`;
    });
    xml += `  </anulados>\n`;
  } else {
    xml += `  <anulados/>\n`;
  }

  xml += `</iva>`;

  return {
    success: true,
    xml,
    filename,
    stats,
    message: `XML ATS generado exitosamente para el período fiscal ${mes}/${anio}.`,
    source: 'LOCAL'
  };
}

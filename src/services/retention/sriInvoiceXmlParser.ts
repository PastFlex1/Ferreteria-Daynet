/**
 * @fileOverview Parser inteligente de Facturas Electrónicas del SRI (Ecuador).
 * Permite importar archivos XML (o respuestas SOAP del SRI) para extraer automáticamente
 * todos los datos del emisor/proveedor, número de comprobante, clave de acceso,
 * fechas, bases imponibles e impuestos, y autocompletar el Comprobante de Retención.
 *
 * MEJORA v2: Usa getElementsByTagName (insensible a namespaces) en lugar de
 * querySelector para máxima compatibilidad con XMLs firmados del SRI que incluyen
 * xmlns= declarations que rompen querySelector.
 */

import { ImpuestoDocSustento, RetentionPayment } from '../../types/retention';

export interface ParsedSriInvoice {
  success: boolean;
  error?: string;
  supplier: {
    ruc: string;
    razonSocial: string;
    direccion: string;
    email: string;
    condition: 'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_POPULAR' | 'ESPECIAL';
    tipoId: '04' | '05' | '06';
  };
  invoice: {
    codDocSustento: string; // '01' Factura, '02' Nota de Venta, '03' Liquidación
    estab: string;
    ptoEmi: string;
    secuencial: string;
    numDocSustento: string; // 15 dígitos continuos (ej: '001001000012345')
    formattedNumber: string; // '001-001-000012345'
    claveAcceso: string;
    numAutorizacion: string;
    fechaEmision: string; // DD/MM/YYYY
    isoDate: string; // YYYY-MM-DD
    totalSinImpuestos: number;
    montoIva: number;
    tarifaIva: number;
    importeTotal: number;
    formaPago: string;
    impuestos: ImpuestoDocSustento[];
    pagos: RetentionPayment[];
  };
}

/** Obtiene el texto del PRIMER elemento con ese tagName (ignora namespaces y prefijos) */
function getTagText(doc: Document | Element, tagName: string): string {
  // Intentar con getElementsByTagNameNS('*', ...) que maneja prefijos de namespace
  if (typeof (doc as any).getElementsByTagNameNS === 'function') {
    const nsEls = (doc as any).getElementsByTagNameNS('*', tagName);
    if (nsEls && nsEls.length > 0) {
      return (nsEls[0].textContent || '').trim();
    }
  }
  // Fallback con getElementsByTagName
  const els = (doc as any).getElementsByTagName(tagName);
  if (els && els.length > 0) {
    return (els[0].textContent || '').trim();
  }
  return '';
}

/** Obtiene todos los elementos con ese tagName */
function getAllTags(doc: Document | Element, tagName: string): Element[] {
  const result: Element[] = [];
  const els = (doc as any).getElementsByTagName(tagName);
  for (let i = 0; i < els.length; i++) {
    result.push(els[i]);
  }
  return result;
}

export class SriInvoiceXmlParser {
  /**
   * Parsea el contenido XML de una factura electrónica (firmada o autorizada con CDATA).
   * Implementa validaciones estrictas contra ataques XXE y no interpreta DTDs ni entidades externas.
   */
  public static parseXml(rawXml: string): ParsedSriInvoice {
    if (!rawXml || typeof rawXml !== 'string' || rawXml.trim().length === 0) {
      return { success: false, error: 'El contenido XML proporcionado está vacío.', supplier: {} as any, invoice: {} as any };
    }

    // Seguridad: Bloquear posibles ataques XXE o scripts antes de procesar
    if (/<!DOCTYPE|<!ENTITY/i.test(rawXml)) {
      return {
        success: false,
        error: 'Seguridad: El archivo XML contiene directivas DOCTYPE o ENTITY externas no permitidas.',
        supplier: {} as any,
        invoice: {} as any,
      };
    }
    if (/<script/i.test(rawXml)) {
      return {
        success: false,
        error: 'Seguridad: El archivo XML contiene scripts o contenido ejecutable no permitido.',
        supplier: {} as any,
        invoice: {} as any,
      };
    }

    try {
      let invoiceXml = rawXml.trim();

      // Extraer número de autorización del contenedor exterior si existe (antes de modificar invoiceXml)
      const autMatch = rawXml.match(/<numeroAutorizacion[^>]*>(.*?)<\/numeroAutorizacion>/i);
      const outerNumAut = autMatch ? autMatch[1].trim() : '';

      // 1. Si es un XML de autorización del SRI que envuelve la factura en CDATA:
      // <autorizacion><comprobante><![CDATA[<factura ...>]]></comprobante></autorizacion>
      const cdataMatch = invoiceXml.match(/<comprobante[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/comprobante>/i);
      if (cdataMatch && cdataMatch[1]) {
        invoiceXml = cdataMatch[1].trim();
      } else {
        // Comprobante sin CDATA — puede ser HTML-encoded
        const compMatch = invoiceXml.match(/<comprobante[^>]*>([\s\S]*?)<\/comprobante>/i);
        if (compMatch && compMatch[1]) {
          const inner = compMatch[1].trim();
          if (inner.includes('&lt;factura') || inner.includes('&lt;liquidacionCompra') || inner.includes('&lt;notaCredito')) {
            invoiceXml = inner
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/&amp;/g, '&');
          }
        }
      }

      // 2. Parsear el XML de la factura
      if (typeof DOMParser === 'undefined') {
        // Fallback para entornos sin DOM (tests Node)
        return SriInvoiceXmlParser.parseWithRegex(invoiceXml, outerNumAut);
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(invoiceXml, 'text/xml');

      // Verificar errores de parseo
      const parseError = doc.querySelector('parsererror') || getAllTags(doc, 'parsererror')[0];
      if (parseError) {
        // Intentar con fallback regex antes de rendirse
        console.warn('[SriParser] DOMParser falló, usando fallback regex:', parseError.textContent?.substring(0, 150));
        return SriInvoiceXmlParser.parseWithRegex(invoiceXml, outerNumAut);
      }

      // 3. Extraer <infoTributaria> usando getElementsByTagName (insensible a namespaces)
      const ruc       = getTagText(doc, 'ruc');
      const razonSocial = getTagText(doc, 'razonSocial') || getTagText(doc, 'nombreComercial');
      const dirMatriz = getTagText(doc, 'dirMatriz');
      const estab     = (getTagText(doc, 'estab') || '001').padStart(3, '0');
      const ptoEmi    = (getTagText(doc, 'ptoEmi') || '001').padStart(3, '0');
      const secuencial = (getTagText(doc, 'secuencial') || '000000001').padStart(9, '0');
      const claveAcceso = getTagText(doc, 'claveAcceso') || outerNumAut;
      const codDoc    = getTagText(doc, 'codDoc') || '01';

      // Regímenes del emisor
      const contribuyenteRimpe = getTagText(doc, 'contribuyenteRimpe').toUpperCase();
      const contribuyenteEspecial = getTagText(doc, 'contribuyenteEspecial');

      // 4. Extraer <infoFactura> o <infoLiquidacionCompra>
      const fechaEmision       = getTagText(doc, 'fechaEmision');
      const dirEstablecimiento = getTagText(doc, 'dirEstablecimiento') || dirMatriz;
      const totalSinImpuestos  = parseFloat(getTagText(doc, 'totalSinImpuestos')) || 0;
      const importeTotal       = parseFloat(getTagText(doc, 'importeTotal')) || 0;

      // 5. Extraer impuestos (totalConImpuestos > totalImpuesto)
      let montoIva = 0;
      let tarifaIva = 15;
      const impuestos: ImpuestoDocSustento[] = [];

      // Buscar en totalConImpuestos primero, luego en impuestos genérico
      const totalImpuestoEls = getAllTags(doc, 'totalImpuesto');
      const impuestoEls = totalImpuestoEls.length > 0 ? totalImpuestoEls : getAllTags(doc, 'impuesto');

      impuestoEls.forEach((imp) => {
        const codigo   = getTagText(imp, 'codigo') || '2';
        const codPorc  = getTagText(imp, 'codigoPorcentaje') || '4';
        const base     = parseFloat(getTagText(imp, 'baseImponible')) || 0;
        const valor    = parseFloat(getTagText(imp, 'valor')) || 0;
        let tarifa     = parseFloat(getTagText(imp, 'tarifa')) || 0;

        if (codigo === '2') { // 2 = IVA
          montoIva = Math.round((montoIva + valor + Number.EPSILON) * 100) / 100;
          if (!tarifa) {
            if (codPorc === '4') tarifa = 15;
            else if (codPorc === '5') tarifa = 5;
            else if (codPorc === '0') tarifa = 0;
            else if (codPorc === '2') tarifa = 12;
          }
          tarifaIva = tarifa;
        }

        impuestos.push({
          codImpuestoDocSustento: codigo,
          codigoPorcentaje: codPorc,
          baseImponible: Math.round((base + Number.EPSILON) * 100) / 100,
          tarifa,
          valorImpuesto: Math.round((valor + Number.EPSILON) * 100) / 100,
        });
      });

      // Si no se encontraron impuestos pero hay subtotal
      if (impuestos.length === 0 && totalSinImpuestos > 0) {
        impuestos.push({
          codImpuestoDocSustento: '2',
          codigoPorcentaje: '4', // 15%
          baseImponible: totalSinImpuestos,
          tarifa: 15.0,
          valorImpuesto: Math.round((totalSinImpuestos * 0.15 + Number.EPSILON) * 100) / 100,
        });
        montoIva = Math.round((totalSinImpuestos * 0.15 + Number.EPSILON) * 100) / 100;
      }

      // 6. Extraer formas de pago
      const pagos: RetentionPayment[] = [];
      const pagoEls = getAllTags(doc, 'pago');
      pagoEls.forEach((p) => {
        const forma        = getTagText(p, 'formaPago') || '20';
        const total        = parseFloat(getTagText(p, 'total')) || 0;
        const plazoText    = getTagText(p, 'plazo');
        const plazo        = plazoText ? parseInt(plazoText, 10) : undefined;
        const unidadTiempo = getTagText(p, 'unidadTiempo') || undefined;
        pagos.push({
          formaPago: forma,
          total: Math.round((total + Number.EPSILON) * 100) / 100,
          plazo: isNaN(plazo as any) ? undefined : plazo,
          unidadTiempo,
        });
      });

      const formaPago = pagos[0]?.formaPago || '20';
      if (pagos.length === 0) {
        pagos.push({ formaPago: '20', total: importeTotal || totalSinImpuestos });
      }

      // 7. Extraer email de <infoAdicional>
      let email = '';
      const campoEls = getAllTags(doc, 'campoAdicional');
      campoEls.forEach((campo) => {
        const nombre = ((campo as Element).getAttribute('nombre') || '').toLowerCase();
        const valor  = (campo.textContent || '').trim();
        if ((nombre.includes('email') || nombre.includes('correo')) && !email) {
          email = valor;
        }
      });

      // 8. Normalizar fecha ISO
      let isoDate = new Date().toISOString().split('T')[0];
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaEmision)) {
        const [dd, mm, yyyy] = fechaEmision.split('/');
        isoDate = `${yyyy}-${mm}-${dd}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(fechaEmision)) {
        isoDate = fechaEmision.substring(0, 10);
      }

      // 9. Condición tributaria del proveedor
      let condition: 'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_POPULAR' | 'ESPECIAL' = 'GENERAL';
      if (contribuyenteRimpe.includes('POPULAR')) condition = 'RIMPE_POPULAR';
      else if (contribuyenteRimpe.includes('RIMPE') || contribuyenteRimpe.includes('EMPRENDEDOR')) condition = 'RIMPE_EMPRENDEDOR';
      else if (contribuyenteEspecial) condition = 'ESPECIAL';

      // 10. Tipo de identificación
      const cleanRuc = ruc.replace(/\D/g, '');
      const tipoId: '04' | '05' | '06' = cleanRuc.length === 13 ? '04' : cleanRuc.length === 10 ? '05' : '06';

      const numDocSustento  = `${estab}${ptoEmi}${secuencial}`;
      const formattedNumber = `${estab}-${ptoEmi}-${secuencial}`;

      return {
        success: true,
        supplier: {
          ruc: cleanRuc,
          razonSocial,
          direccion: dirEstablecimiento || dirMatriz || 'MATRIZ',
          email,
          condition,
          tipoId,
        },
        invoice: {
          codDocSustento: codDoc || '01',
          estab,
          ptoEmi,
          secuencial,
          numDocSustento,
          formattedNumber,
          claveAcceso,
          numAutorizacion: outerNumAut || claveAcceso,
          fechaEmision,
          isoDate,
          totalSinImpuestos,
          montoIva,
          tarifaIva,
          importeTotal,
          formaPago,
          impuestos,
          pagos,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Error al procesar el comprobante electrónico: ${err.message || err}`,
        supplier: {} as any,
        invoice: {} as any,
      };
    }
  }

  /**
   * Fallback: Parser por regex para entornos donde DOMParser no está disponible
   * o cuando el XML no puede parsearse con DOMParser (ej: XML con errores menores).
   */
  public static parseWithRegex(xml: string, outerNumAut = ''): ParsedSriInvoice {
    const getTag = (tag: string, content: string): string => {
      const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return match ? match[1].trim().replace(/<[^>]+>/g, '') : '';
    };

    const getTags = (tag: string, content: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      const results: string[] = [];
      let m;
      while ((m = regex.exec(content)) !== null) results.push(m[1]);
      return results;
    };

    try {
      const ruc         = getTag('ruc', xml);
      const razonSocial = getTag('razonSocial', xml) || getTag('nombreComercial', xml);
      const dirMatriz   = getTag('dirMatriz', xml);
      const estab       = (getTag('estab', xml) || '001').padStart(3, '0');
      const ptoEmi      = (getTag('ptoEmi', xml) || '001').padStart(3, '0');
      const secuencial  = (getTag('secuencial', xml) || '000000001').padStart(9, '0');
      const claveAcceso = getTag('claveAcceso', xml) || outerNumAut;
      const codDoc      = getTag('codDoc', xml) || '01';
      const contribuyenteRimpe = getTag('contribuyenteRimpe', xml).toUpperCase();
      const contribuyenteEspecial = getTag('contribuyenteEspecial', xml);
      const fechaEmision = getTag('fechaEmision', xml);
      const dirEstab    = getTag('dirEstablecimiento', xml) || dirMatriz;
      const totalSinImpuestos = parseFloat(getTag('totalSinImpuestos', xml)) || 0;
      const importeTotal = parseFloat(getTag('importeTotal', xml)) || 0;

      // Impuestos
      let montoIva = 0;
      let tarifaIva = 15;
      const impuestos: ImpuestoDocSustento[] = [];
      const impRaw = getTags('totalImpuesto', xml).concat(getTags('impuesto', xml));
      impRaw.forEach((raw) => {
        const codigo  = getTag('codigo', raw) || '2';
        const codPorc = getTag('codigoPorcentaje', raw) || '4';
        const base    = parseFloat(getTag('baseImponible', raw)) || 0;
        const valor   = parseFloat(getTag('valor', raw)) || 0;
        let tarifa    = parseFloat(getTag('tarifa', raw)) || 0;
        if (codigo === '2') {
          montoIva += valor;
          if (!tarifa) { if (codPorc === '4') tarifa = 15; else if (codPorc === '0') tarifa = 0; }
          tarifaIva = tarifa;
        }
        impuestos.push({ codImpuestoDocSustento: codigo, codigoPorcentaje: codPorc, baseImponible: base, tarifa, valorImpuesto: valor });
      });
      if (impuestos.length === 0 && totalSinImpuestos > 0) {
        const iva = Math.round(totalSinImpuestos * 0.15 * 100) / 100;
        impuestos.push({ codImpuestoDocSustento: '2', codigoPorcentaje: '4', baseImponible: totalSinImpuestos, tarifa: 15, valorImpuesto: iva });
        montoIva = iva;
      }

      // Pagos
      const pagos: RetentionPayment[] = [];
      getTags('pago', xml).forEach((raw) => {
        const forma = getTag('formaPago', raw) || '20';
        const total = parseFloat(getTag('total', raw)) || 0;
        pagos.push({ formaPago: forma, total });
      });
      if (pagos.length === 0) pagos.push({ formaPago: '20', total: importeTotal });

      // Email
      let email = '';
      const campoRegex = /<campoAdicional\s+nombre=["']([^"']*)["'][^>]*>([\s\S]*?)<\/campoAdicional>/gi;
      let cm;
      while ((cm = campoRegex.exec(xml)) !== null) {
        if ((cm[1].toLowerCase().includes('email') || cm[1].toLowerCase().includes('correo')) && !email) email = cm[2].trim();
      }

      // Fecha ISO
      let isoDate = new Date().toISOString().split('T')[0];
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaEmision)) {
        const [dd, mm, yyyy] = fechaEmision.split('/');
        isoDate = `${yyyy}-${mm}-${dd}`;
      }

      let condition: 'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_POPULAR' | 'ESPECIAL' = 'GENERAL';
      if (contribuyenteRimpe.includes('POPULAR')) condition = 'RIMPE_POPULAR';
      else if (contribuyenteRimpe.includes('RIMPE')) condition = 'RIMPE_EMPRENDEDOR';
      else if (contribuyenteEspecial) condition = 'ESPECIAL';

      const cleanRuc = ruc.replace(/\D/g, '');
      const tipoId: '04' | '05' | '06' = cleanRuc.length === 13 ? '04' : cleanRuc.length === 10 ? '05' : '06';

      return {
        success: true,
        supplier: { ruc: cleanRuc, razonSocial, direccion: dirEstab || 'MATRIZ', email, condition, tipoId },
        invoice: {
          codDocSustento: codDoc, estab, ptoEmi, secuencial,
          numDocSustento: `${estab}${ptoEmi}${secuencial}`,
          formattedNumber: `${estab}-${ptoEmi}-${secuencial}`,
          claveAcceso, numAutorizacion: outerNumAut || claveAcceso,
          fechaEmision, isoDate, totalSinImpuestos, montoIva, tarifaIva,
          importeTotal, formaPago: pagos[0]?.formaPago || '20', impuestos, pagos,
        },
      };
    } catch (err: any) {
      return { success: false, error: `Error en fallback regex: ${err.message}`, supplier: {} as any, invoice: {} as any };
    }
  }

  /**
   * @deprecated Alias mantenido por compatibilidad con tests existentes.
   */
  public static parseXmlUniversal(xml: string) {
    const getTag = (tag: string, content: string): string => {
      const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return match ? match[1].trim() : '';
    };
    const getTags = (tag: string, content: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      const results: string[] = [];
      let m;
      while ((m = regex.exec(content)) !== null) results.push(m[1]);
      return results;
    };
    return {
      querySelector: (selector: string) => {
        const parts = selector.split(/\s*>\s*|\s+/).filter(Boolean);
        let cur = xml;
        for (const p of parts) { cur = getTag(p, cur); if (!cur) return null; }
        return { textContent: cur.replace(/<[^>]+>/g, '').trim() };
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes('totalImpuesto') || selector.includes('impuesto')) {
          const rawItems = getTags('totalImpuesto', xml).concat(getTags('impuesto', xml));
          return rawItems.map((raw) => ({ querySelector: (sel: string) => { const val = getTag(sel, raw); return val ? { textContent: val } : null; } }));
        }
        if (selector.includes('pago')) {
          return getTags('pago', xml).map((raw) => ({ querySelector: (sel: string) => { const val = getTag(sel, raw); return val ? { textContent: val } : null; } }));
        }
        if (selector.includes('campoAdicional')) {
          const regex = /<campoAdicional\s+nombre=["']([^"']*)["'][^>]*>([\s\S]*?)<\/campoAdicional>/gi;
          const items: any[] = [];
          let m;
          while ((m = regex.exec(xml)) !== null) items.push({ getAttribute: (name: string) => (name === 'nombre' ? m![1] : null), textContent: m![2].trim() });
          return items;
        }
        return [];
      }
    };
  }
}

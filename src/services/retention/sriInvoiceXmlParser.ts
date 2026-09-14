/**
 * @fileOverview Parser inteligente de Facturas Electrónicas del SRI (Ecuador).
 * Permite importar archivos XML (o respuestas SOAP del SRI) para extraer automáticamente
 * todos los datos del emisor/proveedor, número de comprobante, clave de acceso,
 * fechas, bases imponibles e impuestos, y autocompletar el Comprobante de Retención.
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

      // 1. Si es un XML de autorización del SRI que envuelve la factura en CDATA:
      // <autorizacion><comprobante><![CDATA[<factura ...>]]></comprobante></autorizacion>
      const cdataMatch = invoiceXml.match(/<comprobante>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/comprobante>/i);
      if (cdataMatch && cdataMatch[1]) {
        invoiceXml = cdataMatch[1].trim();
      } else {
        const compMatch = invoiceXml.match(/<comprobante>([\s\S]*?)<\/comprobante>/i);
        if (compMatch && compMatch[1]) {
          const inner = compMatch[1].trim();
          if (inner.includes('&lt;factura') || inner.includes('&lt;liquidacionCompra')) {
            invoiceXml = inner
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/&amp;/g, '&');
          }
        }
      }

      // Extraer número de autorización del contenedor exterior si existe
      const autMatch = rawXml.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/i);
      const outerNumAut = autMatch ? autMatch[1].trim() : '';

      // 2. Parsear el XML de la factura (con soporte universal para Navegador y entornos de Test/Node)
      let doc: any;
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        doc = parser.parseFromString(invoiceXml, 'text/xml');

        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          return {
            success: false,
            error: `Error al procesar la sintaxis del archivo XML: ${parseError.textContent?.substring(0, 200)}`,
            supplier: {} as any,
            invoice: {} as any,
          };
        }
      } else {
        // Fallback universal para Node / Test runners
        doc = SriInvoiceXmlParser.parseXmlUniversal(invoiceXml);
      }

      // 3. Extraer <infoTributaria>
      const ruc = doc.querySelector('infoTributaria > ruc')?.textContent?.trim() || '';
      const razonSocial = doc.querySelector('infoTributaria > razonSocial')?.textContent?.trim() || 
                          doc.querySelector('infoTributaria > nombreComercial')?.textContent?.trim() || '';
      const dirMatriz = doc.querySelector('infoTributaria > dirMatriz')?.textContent?.trim() || '';
      const estab = (doc.querySelector('infoTributaria > estab')?.textContent?.trim() || '001').padStart(3, '0');
      const ptoEmi = (doc.querySelector('infoTributaria > ptoEmi')?.textContent?.trim() || '001').padStart(3, '0');
      const secuencial = (doc.querySelector('infoTributaria > secuencial')?.textContent?.trim() || '000000001').padStart(9, '0');
      const claveAcceso = doc.querySelector('infoTributaria > claveAcceso')?.textContent?.trim() || outerNumAut;
      const codDoc = doc.querySelector('infoTributaria > codDoc')?.textContent?.trim() || '01';

      // Regímenes del emisor/proveedor
      const contribuyenteRimpe = (doc.querySelector('infoTributaria > contribuyenteRimpe')?.textContent?.trim() || '').toUpperCase();
      const contribuyenteEspecial = doc.querySelector('infoFactura > contribuyenteEspecial, infoTributaria > contribuyenteEspecial')?.textContent?.trim() || '';

      // 4. Extraer <infoFactura> o <infoLiquidacionCompra>
      const infoFactura = doc.querySelector('infoFactura, infoLiquidacionCompra');
      const fechaEmision = infoFactura?.querySelector('fechaEmision')?.textContent?.trim() || '';
      const dirEstablecimiento = infoFactura?.querySelector('dirEstablecimiento')?.textContent?.trim() || dirMatriz;
      const totalSinImpuestos = parseFloat(infoFactura?.querySelector('totalSinImpuestos')?.textContent || '0') || 0;
      const importeTotal = parseFloat(infoFactura?.querySelector('importeTotal')?.textContent || '0') || 0;

      // Extraer array completo de impuestos de sustento (<impuestosDocSustento>)
      let montoIva = 0;
      let tarifaIva = 15;
      const impuestos: ImpuestoDocSustento[] = [];
      const totalImpuestos = doc.querySelectorAll('totalConImpuestos > totalImpuesto, impuestos > impuesto');
      
      totalImpuestos.forEach((imp) => {
        const codigo = imp.querySelector('codigo')?.textContent?.trim() || '2';
        const codPorc = imp.querySelector('codigoPorcentaje')?.textContent?.trim() || '4';
        const base = parseFloat(imp.querySelector('baseImponible')?.textContent || '0') || 0;
        const valor = parseFloat(imp.querySelector('valor')?.textContent || '0') || 0;
        let tarifa = parseFloat(imp.querySelector('tarifa')?.textContent || '0') || 0;

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

      // Si no se encontraron impuestos pero hay subtotal, agregar IVA por defecto
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

      // Extraer array completo de formas de pago (<pagos>)
      const pagos: RetentionPayment[] = [];
      const pagoNodes = doc.querySelectorAll('pagos > pago');
      pagoNodes.forEach((p) => {
        const forma = p.querySelector('formaPago')?.textContent?.trim() || '20';
        const total = parseFloat(p.querySelector('total')?.textContent || '0') || 0;
        const plazoText = p.querySelector('plazo')?.textContent?.trim();
        const plazo = plazoText ? parseInt(plazoText, 10) : undefined;
        const unidadTiempo = p.querySelector('unidadTiempo')?.textContent?.trim() || undefined;

        pagos.push({
          formaPago: forma,
          total: Math.round((total + Number.EPSILON) * 100) / 100,
          plazo: isNaN(plazo as any) ? undefined : plazo,
          unidadTiempo,
        });
      });

      const formaPago = pagos[0]?.formaPago || doc.querySelector('pagos > pago > formaPago')?.textContent?.trim() || '20';
      if (pagos.length === 0) {
        pagos.push({
          formaPago: '20',
          total: importeTotal || totalSinImpuestos,
        });
      }

      // 5. Extraer <infoAdicional> (email, teléfono)
      let email = '';
      const camposAdicionales = doc.querySelectorAll('infoAdicional > campoAdicional');
      camposAdicionales.forEach((campo) => {
        const nombre = (campo.getAttribute('nombre') || '').toLowerCase();
        const valor = campo.textContent?.trim() || '';
        if (nombre.includes('email') || nombre.includes('correo')) {
          if (!email) email = valor;
        }
      });

      // 6. Normalizaciones
      // Formato ISO de fecha para inputs HTML date (YYYY-MM-DD)
      let isoDate = new Date().toISOString().split('T')[0];
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaEmision)) {
        const [dd, mm, yyyy] = fechaEmision.split('/');
        isoDate = `${yyyy}-${mm}-${dd}`;
      }

      // Condición tributaria del proveedor
      let condition: 'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_POPULAR' | 'ESPECIAL' = 'GENERAL';
      if (contribuyenteRimpe.includes('POPULAR')) {
        condition = 'RIMPE_POPULAR';
      } else if (contribuyenteRimpe.includes('RIMPE') || contribuyenteRimpe.includes('EMPRENDEDOR')) {
        condition = 'RIMPE_EMPRENDEDOR';
      } else if (contribuyenteEspecial) {
        condition = 'ESPECIAL';
      }

      // Tipo de identificación
      const cleanRuc = ruc.replace(/\D/g, '');
      const tipoId: '04' | '05' | '06' = cleanRuc.length === 13 ? '04' : cleanRuc.length === 10 ? '05' : '06';

      const numDocSustento = `${estab}${ptoEmi}${secuencial}`;
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
   * Parser universal ligero para entornos donde DOMParser no está disponible globalmente (ej: tests Node).
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
      while ((m = regex.exec(content)) !== null) {
        results.push(m[1]);
      }
      return results;
    };

    return {
      querySelector: (selector: string) => {
        const parts = selector.split(/\s*>\s*|\s+/).filter(Boolean);
        let cur = xml;
        for (const p of parts) {
          cur = getTag(p, cur);
          if (!cur) return null;
        }
        return { textContent: cur.replace(/<[^>]+>/g, '').trim() };
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes('totalImpuesto') || selector.includes('impuesto')) {
          const rawItems = getTags('totalImpuesto', xml).concat(getTags('impuesto', xml));
          return rawItems.map((raw) => ({
            querySelector: (sel: string) => {
              const val = getTag(sel, raw);
              return val ? { textContent: val } : null;
            }
          }));
        }
        if (selector.includes('pago')) {
          const rawItems = getTags('pago', xml);
          return rawItems.map((raw) => ({
            querySelector: (sel: string) => {
              const val = getTag(sel, raw);
              return val ? { textContent: val } : null;
            }
          }));
        }
        if (selector.includes('campoAdicional')) {
          const regex = /<campoAdicional\s+nombre=["']([^"']*)["'][^>]*>([\s\S]*?)<\/campoAdicional>/gi;
          const items: any[] = [];
          let m;
          while ((m = regex.exec(xml)) !== null) {
            const attrNombre = m[1];
            const textVal = m[2].trim();
            items.push({
              getAttribute: (name: string) => (name === 'nombre' ? attrNombre : null),
              textContent: textVal,
            });
          }
          return items;
        }
        return [];
      }
    };
  }
}


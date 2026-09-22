/**
 * @fileOverview Servicio Cliente para comunicar el ERP con el Backend Java API SRI (Localhost o Railway).
 * Implementa el flujo de 3 pasos (Firma -> Recepción -> Autorización con reintentos para "EN PROCESO")
 * idéntico al backend en producción y compatible con el API Java local.
 */

import { SRIInvoiceData, generateInvoiceXML, convertERPInvoiceToSRI, generateCreditNoteXML, convertCreditNoteToSRI } from './sriXmlService';
import { Invoice, StoreSettings } from '../types';
import { SRIRetentionData } from '../types/retention';
import { SriRetentionXmlGenerator } from './retention/SriRetentionXmlGenerator';
import { RetentionXsdValidator } from './retention/RetentionXsdValidator';

export interface SriEmissionResult {
  success: boolean;
  claveAcceso: string;
  estado: 'AUTORIZADO' | 'DEVUELTA' | 'NO AUTORIZADO' | 'EN PROCESO' | 'ERROR' | 'PENDIENTE';
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  xmlOriginal: string;
  xmlFirmado?: string;
  mensaje?: string;
  rawRecepcion?: string;
  rawAutorizacion?: string;
  nuevoSecuencial?: string;
  nuevoId?: string;
  nuevoFullNumber?: string;
}

/**
 * Detecta si la respuesta del SRI indica que el secuencial o clave de acceso ya fue previamente registrado/autorizado
 * (Error 43 del SRI o mensajes equivalentes de comprobante ya registrado).
 */
export function isSecuencialAlreadyRegistered(rawResponse?: string, errorMsg?: string): boolean {
  const combined = `${rawResponse || ''} ${errorMsg || ''}`.toUpperCase();
  return (
    combined.includes('CLAVE ACCESO REGISTRADA') ||
    combined.includes('CLAVE DE ACCESO REGISTRADA') ||
    combined.includes('SECUENCIAL REGISTRADO') ||
    combined.includes('SECUENCIAL YA REGISTRADO') ||
    combined.includes('ERROR SECUENCIAL REGISTRADO') ||
    combined.includes('NUMERO DE COMPROBANTE YA SE ENCUENTRA REGISTRADO') ||
    combined.includes('COMPROBANTE YA SE ENCUENTRA REGISTRADO') ||
    combined.includes('COMPROBANTE REGISTRADO PREVIAMENTE') ||
    combined.includes('SECUENCIAL YA UTILIZADO') ||
    combined.includes('COMPROBANTE YA AUTORIZADO') ||
    combined.includes('YA FUE CONSULTADA') ||
    combined.includes('IDENTIFICADOR>43<') ||
    combined.includes('<IDENTIFICADOR>43</IDENTIFICADOR>') ||
    combined.includes('[ERROR 43]') ||
    combined.includes('CODIGO 43') ||
    combined.includes('CÓDIGO 43')
  );
}

export class SriBackendService {
  private static defaultBaseUrl = 'http://localhost:8080';

  /**
   * Obtiene la URL base configurada para la API Java local del SRI (Spring Boot).
   * Siempre devuelve el host base (ej: http://localhost:8080).
   */
  public static getBaseUrl(): string {
    const saved = localStorage.getItem('ferreteria_sri_api_url');
    let target = this.defaultBaseUrl;
    if (saved && saved.trim() !== '') {
      target = saved.trim().replace(/\/$/, '').replace(/\/api\/sri\/?$/, '');
    }
    // Si estamos en el navegador y el host objetivo es localhost:8080 o 127.0.0.1:8080,
    // devolver '' para que las peticiones se enruten vía proxy de Vite (/api/sri)
    // eliminando problemas de CORS en desarrollo local.
    if (typeof window !== 'undefined' && /^https?:\/\/(localhost|127\.0\.0\.1):8080$/i.test(target)) {
      return '';
    }
    return target;
  }

  /**
   * Guarda la URL base configurada para el backend local.
   */
  public static setBaseUrl(url: string) {
    const cleanUrl = (url || 'http://localhost:8080').trim().replace(/\/$/, '').replace(/\/api\/sri\/?$/, '');
    localStorage.setItem('ferreteria_sri_api_url', cleanUrl);
  }

  /**
   * Prueba la conectividad con el backend Java local (Spring Boot).
   */
  public static async testConnection(targetUrl?: string): Promise<{ ok: boolean; message: string; urlUsed: string }> {
    const rawTarget = targetUrl || localStorage.getItem('ferreteria_sri_api_url') || this.defaultBaseUrl;
    const displayUrl = rawTarget.trim().replace(/\/$/, '');
    let baseUrl = targetUrl ? targetUrl.replace(/\/$/, '').replace(/\/api\/sri\/?$/, '') : this.getBaseUrl();
    
    if (typeof window !== 'undefined' && /^https?:\/\/(localhost|127\.0\.0\.1):8080$/i.test(baseUrl)) {
      baseUrl = '';
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl}/api/sri/test-cors`, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(`${baseUrl}/api/sri`, { method: 'GET', signal: controller.signal }).catch(() => null);
      });

      clearTimeout(timeoutId);

      if (response && response.status === 200) {
        return { 
          ok: true, 
          message: `Conexión con Backend Java local exitosa (200 OK).`,
          urlUsed: displayUrl
        };
      }
      if (response && response.status === 404) {
        return {
          ok: false,
          message: `El servidor en ${displayUrl} respondió 404 Not Found. Asegúrese de que el backend Java Spring Boot esté en ejecución en ese puerto.`,
          urlUsed: displayUrl
        };
      }
      return { 
        ok: false, 
        message: `El servidor respondió con código HTTP: ${response ? response.status : 'desconocido'}`,
        urlUsed: displayUrl 
      };
    } catch (err: any) {
      return { 
        ok: false, 
        message: `No se pudo conectar con ${displayUrl}. Asegúrese de ejecutar su proyecto Spring Boot local.`,
        urlUsed: displayUrl
      };
    }
  }

  /**
   * 1️⃣ FIRMAR XML
   * Envía el XML sin firmar al backend local para firmarlo con XAdES-BES
   * pasando dinámicamente el Base64 y contraseña almacenados.
   */
  public static async firmarXml(
    xml: string,
    certBase64?: string,
    password?: string
  ): Promise<{ success: boolean; xmlFirmado?: string; claveAcceso?: string; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const base64 = certBase64 || localStorage.getItem('ferreteria_settings_p12_base64') || '';
      const pass = password ?? (localStorage.getItem('ferreteria_settings_p12_password') || '');

      if (!base64) {
        throw new Error('No se ha cargado la firma electrónica (.p12 en Base64). Diríjase a Configuración > Firma Electrónica para seleccionarla.');
      }

      const payload = {
        xml,
        certificadoBase64: base64,
        password: pass,
      };

      const resFirma = await fetch(`${baseUrl}/api/sri/firmar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!resFirma.ok) {
        const errorText = await resFirma.text();
        throw new Error(errorText || 'Error en el servicio de firma digital.');
      }
      
      const xmlFirmado = await resFirma.text();

      const claveMatch = xml.match(/<claveAcceso>(.*?)<\/claveAcceso>/);
      const claveAcceso = claveMatch ? claveMatch[1] : null;
      
      if (!claveAcceso) {
        throw new Error('No se pudo extraer la clave de acceso del XML.');
      }

      return { success: true, xmlFirmado, claveAcceso };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error en firma digital.' };
    }
  }

  /**
   * 2️⃣ RECEPCIÓN SRI
   * Envía el XML firmado al Web Service de Recepción del SRI.
   */
  public static async recepcionarSri(xmlFirmado: string): Promise<{ success: boolean; recepcion?: string; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const resRecepcion = await fetch(`${baseUrl}/api/sri/recepcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: xmlFirmado,
      });

      if (!resRecepcion.ok) {
        const errorText = await resRecepcion.text();
        throw new Error(errorText || 'El SRI rechazó la recepción del comprobante firmado.');
      }
      const recepcion = await resRecepcion.text();

      return { success: true, recepcion };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error en recepción del SRI.' };
    }
  }

  /**
   * 3️⃣ AUTORIZACIÓN SRI
   * Consulta el Web Service de Autorización con reintentos automáticos si el estado es "EN PROCESO".
   */
  public static async autorizarSri(claveAcceso: string, retries = 4, delayMs = 2000): Promise<{ success: boolean; autorizacion?: string; error?: string }> {
    const baseUrl = this.getBaseUrl();
    let lastError = 'No se pudo consultar la autorización legal definitiva.';
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resAutorizacion = await fetch(`${baseUrl}/api/sri/autorizacion/${claveAcceso}`);

        if (resAutorizacion.ok) {
          const autorizacion = await resAutorizacion.text();
          if (autorizacion.includes('EN PROCESO') && attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }
          return { success: true, autorizacion };
        } else {
          const errorText = await resAutorizacion.text();
          lastError = errorText || 'No se pudo consultar la autorización legal definitiva.';
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      } catch (error: any) {
        lastError = error.message || 'Error en autorización del SRI.';
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * 4️⃣ ANULACIÓN SRI
   * Solicita la anulación de un comprobante al backend.
   */
  public static async anularFactura(
    claveAcceso: string, 
    correo?: string
  ): Promise<{ success: boolean; mensaje?: string; error?: string; isNotImplemented?: boolean }> {
    try {
      const baseUrl = this.getBaseUrl();
      const payload: any = { claveAcceso };
      if (correo) payload.correo = correo;

      const resAnular = await fetch(`${baseUrl}/api/sri/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resAnular.status === 404) {
        return {
          success: false,
          isNotImplemented: true,
          error: 'El backend local no dispone de endpoint /api/sri/anular (en el SRI ecuatoriano no existe un WebService directo para anular facturas autorizadas; se anulan mediante Nota de Crédito o en el portal SRI en Línea).'
        };
      }

      if (!resAnular.ok) {
        const errorText = await resAnular.text();
        let parsedMsg = errorText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.message) parsedMsg = parsed.message;
          else if (parsed.error) parsedMsg = parsed.error;
        } catch (_) {}
        return {
          success: false,
          error: parsedMsg || 'Error al intentar anular la factura en el SRI.'
        };
      }
      
      const mensaje = await resAnular.text();
      return { success: true, mensaje };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error de conexión al anular la factura.' };
    }
  }

  /**
   * 🚀 PIPELINE UNIFICADO DE EMISIÓN DE FACTURA
   * Orquesta:
   * 1. Generación de XML (con Clave de Acceso 49D Módulo 11)
   * 2. Firma Digital XAdES-BES en Backend Java
   * 3. Recepción en SRI
   * 4. Autorización en SRI (con polling)
   * Si el SRI devuelve que el secuencial ya está registrado/autorizado, avanza automáticamente al siguiente.
   */
  public static async emitirFacturaCompleta(
    invoice: Invoice,
    settings: StoreSettings,
    establishment: string = '001',
    emissionPoint: string = '001',
    ambiente: '1' | '2' = '1'
  ): Promise<SriEmissionResult> {
    let currentInvoice = { ...invoice };
    let currentSecNum = parseInt(
      (currentInvoice.fullNumber || '').split('-')[2] || String(currentInvoice.number || '1'),
      10
    );
    let attempts = 0;
    const MAX_ATTEMPTS = 15;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const formattedSec = String(currentSecNum).padStart(9, '0');
      const estab = establishment ? establishment.padStart(3, '0').slice(-3) : '001';
      const ptoEmi = emissionPoint ? emissionPoint.padStart(3, '0').slice(-3) : '001';
      currentInvoice.number = currentSecNum;
      currentInvoice.fullNumber = `${estab}-${ptoEmi}-${formattedSec}`;

      const sriData = convertERPInvoiceToSRI(currentInvoice, settings, estab, ptoEmi, ambiente);
      const { xml: xmlOriginal, claveAcceso } = generateInvoiceXML(sriData);

      try {
        console.log(`[SRI] Intento ${attempts}: emitiendo factura ${currentInvoice.fullNumber} con clave: ${claveAcceso}`);

        // Paso 1: Firma Digital
        const fRes = await this.firmarXml(xmlOriginal);
        if (!fRes.success || !fRes.xmlFirmado) {
          return {
            success: false,
            claveAcceso,
            estado: 'ERROR',
            xmlOriginal,
            mensaje: fRes.error || 'Error al firmar digitalmente el XML.',
            nuevoSecuencial: formattedSec,
            nuevoFullNumber: currentInvoice.fullNumber,
          };
        }

        // Paso 2: Recepción SRI
        const rRes = await this.recepcionarSri(fRes.xmlFirmado);

        // Si el secuencial ya está registrado/autorizado en el SRI, avanzar automáticamente
        if (isSecuencialAlreadyRegistered(rRes.recepcion, rRes.error)) {
          console.warn(`[SRI] Secuencial ${formattedSec} ya registrado en SRI. Avanzando automáticamente al siguiente...`);
          currentSecNum++;
          const nextSecSetting = String(currentSecNum + 1).padStart(9, '0');
          try {
            localStorage.setItem('ferreteria_settings_sec_invoice', nextSecSetting);
            fetch('/api/mongo/doc/ferreteria_settings_sec_invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: nextSecSetting })
            }).catch(() => {});
          } catch (_) {}
          continue;
        }

        if (!rRes.success || !rRes.recepcion) {
          return {
            success: false,
            claveAcceso,
            estado: 'ERROR',
            xmlOriginal,
            xmlFirmado: fRes.xmlFirmado,
            mensaje: rRes.error || 'Error en recepción del comprobante ante el SRI.',
            rawRecepcion: rRes.recepcion,
            nuevoSecuencial: formattedSec,
            nuevoFullNumber: currentInvoice.fullNumber,
          };
        }

        if (rRes.recepcion.includes('DEVUELTA')) {
          const devMsgRegex = /<mensaje>([\s\S]*?)<\/mensaje>/gi;
          const devMsgs: string[] = [];
          let dm;
          while ((dm = devMsgRegex.exec(rRes.recepcion)) !== null) {
            devMsgs.push(dm[1].trim());
          }
          const finalDevMsg = devMsgs.length > 0 ? devMsgs.join(' | ') : 'Comprobante DEVUELTO por el SRI.';

          return {
            success: false,
            claveAcceso,
            estado: 'DEVUELTA',
            xmlOriginal,
            xmlFirmado: fRes.xmlFirmado,
            rawRecepcion: rRes.recepcion,
            mensaje: finalDevMsg,
            nuevoSecuencial: formattedSec,
            nuevoFullNumber: currentInvoice.fullNumber,
          };
        }

        // Pequeña espera para permitir indexación en los servidores del SRI
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Paso 3: Autorización SRI con reintentos
        const aRes = await this.autorizarSri(claveAcceso, 4, 2000);

        if (isSecuencialAlreadyRegistered(aRes.autorizacion, aRes.error) && aRes.autorizacion?.includes('NO AUTORIZADO')) {
          console.warn(`[SRI Autorización] Secuencial ${formattedSec} ya registrado. Avanzando automáticamente al siguiente...`);
          currentSecNum++;
          const nextSecSetting = String(currentSecNum + 1).padStart(9, '0');
          try {
            localStorage.setItem('ferreteria_settings_sec_invoice', nextSecSetting);
            fetch('/api/mongo/doc/ferreteria_settings_sec_invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: nextSecSetting })
            }).catch(() => {});
          } catch (_) {}
          continue;
        }

        if (!aRes.success || !aRes.autorizacion) {
          return {
            success: false,
            claveAcceso,
            estado: 'PENDIENTE',
            xmlOriginal,
            xmlFirmado: fRes.xmlFirmado,
            rawRecepcion: rRes.recepcion,
            mensaje: aRes.error || 'No se pudo obtener respuesta de autorización del SRI.',
            nuevoSecuencial: formattedSec,
            nuevoFullNumber: currentInvoice.fullNumber,
          };
        }

        const isAutorizado = aRes.autorizacion.includes('AUTORIZADO') && !aRes.autorizacion.includes('NO AUTORIZADO');
        const isNoAutorizado = aRes.autorizacion.includes('NO AUTORIZADO');

        const fechaMatch = aRes.autorizacion.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/);
        const numMatch = aRes.autorizacion.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/);

        if (isAutorizado) {
          const nextSecSetting = String(currentSecNum + 1).padStart(9, '0');
          try {
            localStorage.setItem('ferreteria_settings_sec_invoice', nextSecSetting);
            fetch('/api/mongo/doc/ferreteria_settings_sec_invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: nextSecSetting })
            }).catch(() => {});
          } catch (_) {}
        }

        return {
          success: isAutorizado,
          claveAcceso,
          estado: isAutorizado ? 'AUTORIZADO' : (isNoAutorizado ? 'NO AUTORIZADO' : 'PENDIENTE'),
          numeroAutorizacion: numMatch ? numMatch[1] : (isAutorizado ? claveAcceso : undefined),
          fechaAutorizacion: fechaMatch ? fechaMatch[1] : (isAutorizado ? new Date().toLocaleString() : undefined),
          xmlOriginal,
          xmlFirmado: fRes.xmlFirmado,
          rawRecepcion: rRes.recepcion,
          rawAutorizacion: aRes.autorizacion,
          mensaje: isAutorizado ? 'Comprobante AUTORIZADO legalmente por el SRI.' : 'Comprobante procesado por el SRI.',
          nuevoSecuencial: formattedSec,
          nuevoFullNumber: currentInvoice.fullNumber,
        };
      } catch (err: any) {
        console.error('[SRI Critical Error]:', err);
        return {
          success: false,
          claveAcceso,
          estado: 'ERROR',
          xmlOriginal,
          mensaje: err.message || 'Error inesperado durante el procesamiento SRI.',
          nuevoSecuencial: formattedSec,
          nuevoFullNumber: currentInvoice.fullNumber,
        };
      }
    }

    return {
      success: false,
      claveAcceso: '',
      estado: 'ERROR',
      xmlOriginal: '',
      mensaje: 'Límite de reintentos alcanzado intentando encontrar un secuencial disponible.',
    };
  }

  /**
   * 🚀 PIPELINE UNIFICADO DE EMISIÓN DE NOTA DE CRÉDITO (TIPO 04)
   * Orquesta:
   * 1. Generación de XML de Nota de Crédito (con Clave de Acceso 49D Módulo 11)
   * 2. Firma Digital XAdES-BES en Backend Java (/api/sri/firmar)
   * 3. Recepción en SRI (/api/sri/recepcion)
   * 4. Autorización en SRI (/api/sri/autorizacion/{claveAcceso})
   * Si el SRI devuelve que el secuencial ya está registrado/autorizado, avanza automáticamente al siguiente.
   */
  public static async emitirNotaCreditoCompleta(
    creditNote: any,
    settings: StoreSettings,
    invoiceRefDate?: string,
    establishment: string = '001',
    emissionPoint: string = '001',
    ambiente: '1' | '2' = '1',
    certBase64?: string,
    password?: string
  ): Promise<SriEmissionResult> {
    let currentNC = { ...creditNote };
    let currentSecNum = parseInt(
      currentNC.secNumber || (currentNC.id || '').split('-')[2] || '1',
      10
    );
    let attempts = 0;
    const MAX_ATTEMPTS = 15;

    const isConsumidorFinal =
      (currentNC.customerRuc || '').trim() === '9999999999999' ||
      (currentNC.customerRuc || '').trim() === '9999999999' ||
      (currentNC.customer || '').toUpperCase().includes('CONSUMIDOR FINAL') ||
      (currentNC.customer || '').toUpperCase().includes('PUBLICO GENERAL');

    if (isConsumidorFinal) {
      console.warn(`[SRI N/C] Omisión de transmisión al SRI: Las facturas a Consumidor Final no admiten emisión de Notas de Crédito electrónicas según Resolución SRI NAC-DGERCGC25-00000017.`);
      return {
        success: false,
        claveAcceso: currentNC.claveAcceso || '',
        estado: 'DEVUELTA',
        xmlOriginal: '',
        mensaje: 'Por normativa del SRI (Resolución NAC-DGERCGC25-00000017), las facturas emitidas a "Consumidor Final" no admiten emisión de Notas de Crédito electrónicas ante el SRI. El comprobante se registra como devolución interna para control de stock.',
        nuevoSecuencial: currentNC.secNumber,
        nuevoId: currentNC.id,
      };
    }

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const formattedSec = String(currentSecNum).padStart(9, '0');
      const estab = establishment ? establishment.padStart(3, '0').slice(-3) : '001';
      const ptoEmi = emissionPoint ? emissionPoint.padStart(3, '0').slice(-3) : '001';
      currentNC.secNumber = formattedSec;
      currentNC.id = `${estab}-${ptoEmi}-${formattedSec}`;

      const sriData = convertCreditNoteToSRI(currentNC, settings, invoiceRefDate, estab, ptoEmi, ambiente);
      const { xml: xmlOriginal, claveAcceso } = generateCreditNoteXML(sriData);
      currentNC.claveAcceso = claveAcceso;

      try {
        console.log(`[SRI N/C] Intento ${attempts}: emisión para Nota de Crédito ${currentNC.id} con clave: ${claveAcceso}`);

        // Paso 1: Firma Digital en backend local (:8080/api/sri/firmar)
        const fRes = await this.firmarXml(xmlOriginal, certBase64, password);
        if (!fRes.success || !fRes.xmlFirmado) {
          return {
            success: false,
            claveAcceso,
            estado: 'ERROR',
            xmlOriginal,
            mensaje: fRes.error || 'Error al firmar digitalmente la Nota de Crédito.',
            nuevoSecuencial: formattedSec,
            nuevoId: currentNC.id,
          };
        }

        // Paso 2: Recepción SRI (:8080/api/sri/recepcion)
        const rRes = await this.recepcionarSri(fRes.xmlFirmado);

        // Si el secuencial ya está registrado/autorizado en el SRI, avanzar automáticamente al siguiente
        if (isSecuencialAlreadyRegistered(rRes.recepcion, rRes.error)) {
          console.warn(`[SRI N/C] Secuencial ${formattedSec} ya registrado en SRI. Avanzando automáticamente al siguiente...`);
          currentSecNum++;
          const nextSecSetting = String(currentSecNum + 1).padStart(9, '0');
          try {
            localStorage.setItem('ferreteria_settings_sec_credit_note', nextSecSetting);
            fetch('/api/mongo/doc/ferreteria_settings_sec_credit_note', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: nextSecSetting })
            }).catch(() => {});
          } catch (_) {}
          continue;
        }

        if (!rRes.success || !rRes.recepcion) {
          return {
            success: false,
            claveAcceso,
            estado: 'ERROR',
            xmlOriginal,
            xmlFirmado: fRes.xmlFirmado,
            mensaje: rRes.error || 'Error en recepción SRI de la Nota de Crédito.',
            nuevoSecuencial: formattedSec,
            nuevoId: currentNC.id,
          };
        }

        if (rRes.recepcion.includes('DEVUELTA')) {
          return {
            success: false,
            claveAcceso,
            estado: 'DEVUELTA',
            xmlOriginal,
            xmlFirmado: fRes.xmlFirmado,
            rawRecepcion: rRes.recepcion,
            mensaje: 'La Nota de Crédito fue devuelta por el SRI en Recepción.',
            nuevoSecuencial: formattedSec,
            nuevoId: currentNC.id,
          };
        }

        // Pequeña espera para indexación en el SRI
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Paso 3: Autorización SRI (:8080/api/sri/autorizacion/{claveAcceso})
        const aRes = await this.autorizarSri(claveAcceso, 4, 2000);

        if (isSecuencialAlreadyRegistered(aRes.autorizacion, aRes.error) && aRes.autorizacion?.includes('NO AUTORIZADO')) {
          console.warn(`[SRI N/C Autorización] Secuencial ${formattedSec} ya registrado. Avanzando al siguiente...`);
          currentSecNum++;
          const nextSecSetting = String(currentSecNum + 1).padStart(9, '0');
          try {
            localStorage.setItem('ferreteria_settings_sec_credit_note', nextSecSetting);
            fetch('/api/mongo/doc/ferreteria_settings_sec_credit_note', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: nextSecSetting })
            }).catch(() => {});
          } catch (_) {}
          continue;
        }

        if (!aRes.success || !aRes.autorizacion) {
          return {
            success: false,
            claveAcceso,
            estado: 'PENDIENTE',
            xmlOriginal,
            xmlFirmado: fRes.xmlFirmado,
            rawRecepcion: rRes.recepcion,
            mensaje: aRes.error || 'La Nota de Crédito fue recibida por el SRI pero está pendiente de autorización.',
            nuevoSecuencial: formattedSec,
            nuevoId: currentNC.id,
          };
        }

        const isAutorizado = aRes.autorizacion.includes('AUTORIZADO') && !aRes.autorizacion.includes('NO AUTORIZADO');
        const isNoAutorizado = aRes.autorizacion.includes('NO AUTORIZADO');

        const fechaMatch = aRes.autorizacion.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/);
        const numMatch = aRes.autorizacion.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/);

        if (isAutorizado) {
          const nextSecSetting = String(currentSecNum + 1).padStart(9, '0');
          try {
            localStorage.setItem('ferreteria_settings_sec_credit_note', nextSecSetting);
            fetch('/api/mongo/doc/ferreteria_settings_sec_credit_note', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: nextSecSetting })
            }).catch(() => {});
          } catch (_) {}
        }

        return {
          success: isAutorizado,
          claveAcceso,
          estado: isAutorizado ? 'AUTORIZADO' : (isNoAutorizado ? 'NO AUTORIZADO' : 'PENDIENTE'),
          numeroAutorizacion: numMatch ? numMatch[1] : (isAutorizado ? claveAcceso : undefined),
          fechaAutorizacion: fechaMatch ? fechaMatch[1] : (isAutorizado ? new Date().toISOString() : undefined),
          xmlOriginal,
          xmlFirmado: fRes.xmlFirmado,
          rawRecepcion: rRes.recepcion,
          rawAutorizacion: aRes.autorizacion,
          mensaje: isAutorizado ? 'Nota de Crédito AUTORIZADA exitosamente por el SRI.' : 'Nota de Crédito procesada en el SRI.',
          nuevoSecuencial: formattedSec,
          nuevoId: currentNC.id,
        };
      } catch (err: any) {
        console.error('[SRI N/C Critical Error]:', err);
        return {
          success: false,
          claveAcceso,
          estado: 'ERROR',
          xmlOriginal,
          mensaje: err.message || 'Error inesperado durante la emisión de la Nota de Crédito.',
          nuevoSecuencial: formattedSec,
          nuevoId: currentNC.id,
        };
      }
    }

    return {
      success: false,
      claveAcceso: '',
      estado: 'ERROR',
      xmlOriginal: '',
      mensaje: 'Límite de reintentos alcanzado buscando un secuencial disponible.',
    };
  }

  /**
   * 4️⃣.5️⃣ EMISIÓN COMPLETA DE COMPROBANTE DE RETENCIÓN (SRI ATS v2.0.0, codDoc 07)
   * Valida XSD -> Firma XAdES-BES -> Recepción SRI -> Autorización con reintentos.
   * Maneja detección de Error 43 (secuencial ya registrado) incrementando el secuencial de forma idempotente.
   */
  public static async emitirRetencionCompleta(
    retentionData: SRIRetentionData,
    initialSecuencial: string | number,
    settings: StoreSettings,
    maxRetries = 5,
    onProgress?: (step: string, detail?: string) => void
  ): Promise<SriEmissionResult> {
    let currentSec = parseInt(String(initialSecuencial || '1').replace(/\D/g, ''), 10);
    if (isNaN(currentSec) || currentSec <= 0) currentSec = 1;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const formattedSec = String(currentSec + attempt).padStart(9, '0');
      const currentData: SRIRetentionData = {
        ...retentionData,
        secuencial: formattedSec,
      };

      // 1. Validación previa de reglas XSD y tributarias
      onProgress?.('VALIDATING', `Validando estructura contra el esquema oficial ATS v2.0.0 (Secuencial: ${formattedSec})...`);
      const validation = RetentionXsdValidator.validate(currentData);
      if (!validation.isValid) {
        return {
          success: false,
          claveAcceso: '',
          estado: 'ERROR',
          xmlOriginal: '',
          mensaje: `Error de validación XSD previo al envío: ${validation.errors.join(' | ')}`,
        };
      }

      // 2. Generar XML ATS v2.0.0 y Clave de Acceso oficial (49 dígitos, Módulo 11)
      onProgress?.('GENERATING_XML', `Generando XML versión 2.0.0 con Clave de Acceso Módulo 11...`);
      let xmlOriginal = '';
      let claveAcceso = '';
      try {
        const genRes = SriRetentionXmlGenerator.generateXml(currentData);
        xmlOriginal = genRes.xml;
        claveAcceso = genRes.claveAcceso;
      } catch (genErr: any) {
        return {
          success: false,
          claveAcceso: '',
          estado: 'ERROR',
          xmlOriginal: '',
          mensaje: `Error al generar XML del comprobante de retención: ${genErr.message}`,
        };
      }

      // 3. Firma Electrónica XAdES-BES
      onProgress?.('SIGNING', 'Firmando electrónicamente el comprobante con certificado digital (XAdES-BES)...');
      const fRes = await this.firmarXml(xmlOriginal);
      if (!fRes.success || !fRes.xmlFirmado) {
        return {
          success: false,
          claveAcceso,
          estado: 'ERROR',
          xmlOriginal,
          mensaje: `Error en firma digital de la retención: ${fRes.error || 'No se pudo firmar el comprobante'}`,
        };
      }

      // 4. Recepción SRI
      onProgress?.('RECEIVING', 'Enviando comprobante firmado al Web Service de Recepción del SRI...');
      const rRes = await this.recepcionarSri(fRes.xmlFirmado);

      // Verificar si el comprobante fue rechazado por secuencial ya registrado (Error 43)
      if (!rRes.success && isSecuencialAlreadyRegistered(rRes.recepcion, rRes.error)) {
        console.warn(`[SRI Retención] El secuencial ${formattedSec} ya está registrado en el SRI. Avanzando automáticamente al siguiente...`);
        onProgress?.('RETRYING_SECUENCIAL', `Secuencial ${formattedSec} ya registrado en el SRI. Probando con el siguiente secuencial...`);
        continue;
      }

      if (!rRes.success) {
        return {
          success: false,
          claveAcceso,
          estado: 'DEVUELTA',
          xmlOriginal,
          xmlFirmado: fRes.xmlFirmado,
          rawRecepcion: rRes.recepcion,
          mensaje: rRes.error || 'El SRI devolvió el comprobante de retención con observaciones.',
          nuevoSecuencial: formattedSec,
          nuevoId: `${currentData.estab}-${currentData.ptoEmi}-${formattedSec}`,
        };
      }

      // 5. Autorización SRI
      onProgress?.('AUTHORIZING', 'Consultando estado de autorización legal definitiva ante el SRI...');
      const aRes = await this.autorizarSri(claveAcceso, 5, 2500);

      const combinedAut = `${aRes.autorizacion || ''} ${aRes.error || ''}`.toUpperCase();
      const isAutorizado = combinedAut.includes('ESTADO>AUTORIZADO<') || combinedAut.includes('ESTADO>AUTORIZADA<') || combinedAut.includes('<ESTADO>AUTORIZADO</ESTADO>');
      const isNoAutorizado = combinedAut.includes('ESTADO>NO AUTORIZADO<') || combinedAut.includes('ESTADO>DEVUELTA<');

      // Extraer datos de autorización
      const numMatch = aRes.autorizacion ? aRes.autorizacion.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/) : null;
      const fechaMatch = aRes.autorizacion ? aRes.autorizacion.match(/<fechaAutorizacion.*?>(.*?)<\/fechaAutorizacion>/) : null;

      // Actualizar secuencial en almacenamiento local y Firestore si procede
      const nextSecNumber = parseInt(formattedSec, 10) + 1;
      localStorage.setItem('ferreteria_settings_sec_retention', String(nextSecNumber));

      return {
        success: isAutorizado,
        claveAcceso,
        estado: isAutorizado ? 'AUTORIZADO' : (isNoAutorizado ? 'NO AUTORIZADO' : 'PENDIENTE'),
        numeroAutorizacion: numMatch ? numMatch[1] : (isAutorizado ? claveAcceso : undefined),
        fechaAutorizacion: fechaMatch ? fechaMatch[1] : (isAutorizado ? new Date().toISOString() : undefined),
        xmlOriginal,
        xmlFirmado: fRes.xmlFirmado,
        rawRecepcion: rRes.recepcion,
        rawAutorizacion: aRes.autorizacion,
        mensaje: isAutorizado ? 'Comprobante de Retención AUTORIZADO exitosamente por el SRI.' : 'Comprobante de Retención recibido por el SRI (Pendiente de Autorización).',
        nuevoSecuencial: formattedSec,
        nuevoId: `${currentData.estab}-${currentData.ptoEmi}-${formattedSec}`,
      };
    }

    return {
      success: false,
      claveAcceso: '',
      estado: 'ERROR',
      xmlOriginal: '',
      mensaje: 'Límite de reintentos alcanzado buscando un secuencial de retención disponible.',
    };
  }

  /**
   * 5️⃣ GENERAR XML ATS (Anexo Transaccional Simplificado)
   * Envía los datos tributarios al endpoint /api/ats/generate del backend Spring Boot.
   */
  public static async generarAts(payload: {
    mes: string;
    anio: string;
    rucInformante: string;
    razonSocial: string;
    numEstabRuc?: string;
    compras?: any[];
    ventas?: any[];
    anulados?: any[];
  }): Promise<{
    estado: 'OK' | 'ERROR';
    xmlGenerado: boolean;
    contenido?: string;
    metadata?: {
      rucInformante: string;
      razonSocial: string;
      periodo: string;
      totalVentas: number;
      totalCompras: number;
      totalAnulados: number;
      numEstablecimientos: number;
      fechaGeneracion: string;
      versionAts: string;
    };
    errores?: Array<{
      campo: string;
      mensaje: string;
      severidad: 'ERROR' | 'ADVERTENCIA';
    }>;
  }> {
    try {
      const baseUrl = this.getBaseUrl();
      const res = await fetch(`${baseUrl}/api/ats/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return data;
    } catch (error: any) {
      return {
        estado: 'ERROR',
        xmlGenerado: false,
        errores: [
          {
            campo: 'conexion',
            mensaje: error.message || 'Error de conexión con el servicio ATS.',
            severidad: 'ERROR',
          },
        ],
      };
    }
  }
}

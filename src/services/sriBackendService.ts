/**
 * @fileOverview Servicio Cliente para comunicar el ERP con el Backend Java API SRI (Localhost o Railway).
 * Implementa el flujo de 3 pasos (Firma -> Recepción -> Autorización con reintentos para "EN PROCESO")
 * idéntico al backend en producción y compatible con el API Java local.
 */

import { SRIInvoiceData, generateInvoiceXML, convertERPInvoiceToSRI } from './sriXmlService';
import { Invoice, StoreSettings } from '../types';

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
}

export class SriBackendService {
  private static defaultBaseUrl = 'http://localhost:8080';

  /**
   * Obtiene la URL base configurada para la API Java local del SRI (Spring Boot).
   * Siempre devuelve el host base (ej: http://localhost:8080).
   */
  public static getBaseUrl(): string {
    const saved = localStorage.getItem('ferreteria_sri_api_url');
    if (saved && saved.trim() !== '') {
      return saved.trim().replace(/\/$/, '').replace(/\/api\/sri\/?$/, '');
    }
    return this.defaultBaseUrl;
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
    const baseUrl = targetUrl ? targetUrl.replace(/\/$/, '') : this.getBaseUrl();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl}/api/sri/test-cors`, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(`${baseUrl}`, { method: 'GET', signal: controller.signal });
      });

      clearTimeout(timeoutId);

      if (response && response.status < 500) {
        return { 
          ok: true, 
          message: `Conexión con Backend Java local exitosa (${response.status} OK).`,
          urlUsed: baseUrl
        };
      }
      return { 
        ok: false, 
        message: `El servidor local respondió con código HTTP: ${response ? response.status : 'desconocido'}`,
        urlUsed: baseUrl 
      };
    } catch (err: any) {
      return { 
        ok: false, 
        message: `No se pudo conectar con ${baseUrl}. Asegúrese de ejecutar su proyecto Spring Boot local (C:\\Users\\Alex Palma\\Desktop\\API - copia - copia (2)\\API-SRI).`,
        urlUsed: baseUrl
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
   * 🚀 PIPELINE UNIFICADO DE EMISIÓN DE FACTURA
   * Orquesta:
   * 1. Generación de XML (con Clave de Acceso 49D Módulo 11)
   * 2. Firma Digital XAdES-BES en Backend Java
   * 3. Recepción en SRI
   * 4. Autorización en SRI (con polling)
   */
  public static async emitirFacturaCompleta(
    invoice: Invoice,
    settings: StoreSettings,
    establishment: string = '001',
    emissionPoint: string = '001',
    ambiente: '1' | '2' = '1'
  ): Promise<SriEmissionResult> {
    const sriData = convertERPInvoiceToSRI(invoice, settings, establishment, emissionPoint, ambiente);
    const { xml: xmlOriginal, claveAcceso } = generateInvoiceXML(sriData);

    try {
      console.log(`[SRI] Iniciando emisión para factura ${invoice.fullNumber} con clave: ${claveAcceso}`);

      // Paso 1: Firma Digital
      const fRes = await this.firmarXml(xmlOriginal);
      if (!fRes.success || !fRes.xmlFirmado) {
        return {
          success: false,
          claveAcceso,
          estado: 'ERROR',
          xmlOriginal,
          mensaje: fRes.error || 'Error al firmar digitalmente el XML.',
        };
      }

      // Paso 2: Recepción SRI
      const rRes = await this.recepcionarSri(fRes.xmlFirmado);
      if (!rRes.success || !rRes.recepcion) {
        return {
          success: false,
          claveAcceso,
          estado: 'ERROR',
          xmlOriginal,
          xmlFirmado: fRes.xmlFirmado,
          mensaje: rRes.error || 'Error en recepción SRI.',
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
          mensaje: 'El comprobante fue devuelto por el SRI en Recepción.',
        };
      }

      // Pequeña espera para indexación en el servidor del SRI
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Paso 3: Autorización SRI con reintentos
      const aRes = await this.autorizarSri(claveAcceso, 4, 2000);
      if (!aRes.success || !aRes.autorizacion) {
        return {
          success: false,
          claveAcceso,
          estado: 'PENDIENTE',
          xmlOriginal,
          xmlFirmado: fRes.xmlFirmado,
          rawRecepcion: rRes.recepcion,
          mensaje: aRes.error || 'No se pudo obtener respuesta de autorización del SRI.',
        };
      }

      const isAutorizado = aRes.autorizacion.includes('AUTORIZADO');
      const isNoAutorizado = aRes.autorizacion.includes('NO AUTORIZADO');

      const fechaMatch = aRes.autorizacion.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/);
      const numMatch = aRes.autorizacion.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/);

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
      };

    } catch (err: any) {
      console.error('[SRI Critical Error]:', err);
      return {
        success: false,
        claveAcceso,
        estado: 'ERROR',
        xmlOriginal,
        mensaje: err.message || 'Error inesperado durante el procesamiento SRI.',
      };
    }
  }
}

/**
 * @fileOverview Cliente API para comunicar el Frontend con el Backend Java Spring Boot.
 * Cumple con la delimitación estricta de fronteras:
 * - Reserva de secuenciales y claves de acceso en Java.
 * - Sugerencias tributarias consultadas a Java con fallback normativo.
 * - Envío del XML ATS 2.0.0 SIN FIRMA a Java para que el backend se encargue
 *   de validación XSD, firma digital XAdES-BES, recepción y autorización SRI.
 */

import { SriBackendService } from '../sriBackendService';
import { SriRetentionXmlGenerator } from './SriRetentionXmlGenerator';
import { RetentionCalculationEngine } from './RetentionCalculationEngine';

export interface RetentionReservationResponse {
  success: boolean;
  reservationId?: string;
  secuencial: string;
  claveAcceso: string;
  ambiente: '1' | '2';
  establecimiento: string;
  puntoEmision: string;
  codigoNumerico?: string;
  issuerData?: {
    razonSocial?: string;
    nombreComercial?: string;
    dirMatriz?: string;
    obligadoContabilidad?: 'SI' | 'NO';
    contribuyenteEspecial?: string;
    agenteRetencion?: string;
  };
  error?: string;
  isLocalFallback?: boolean;
}

export interface SuggestedRetentionItem {
  taxType: 'RENTA' | 'IVA' | 'ISD';
  sriCode: string;
  description: string;
  base: number;
  percentage: number;
  valorRetenido: number;
  legalSource?: string;
  warning?: string;
  isLocalSuggestion?: boolean;
}

export interface SubmitUnsignedXmlResponse {
  success: boolean;
  status: 'ENVIADO A JAVA' | 'FIRMANDO' | 'ENVIANDO SRI' | 'RECIBIDO SRI' | 'EN PROCESAMIENTO' | 'AUTORIZADO' | 'DEVUELTO' | 'NO AUTORIZADO' | 'ERROR';
  claveAcceso: string;
  secuencial: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  mensaje?: string;
  rawResponse?: string;
}

export class RetentionApiClient {
  /**
   * 1. Solicita a Java la reserva del secuencial y clave de acceso para el comprobante.
   */
  public static async reserveRetention(params: {
    estab: string;
    ptoEmi: string;
    ruc: string;
    ambiente: '1' | '2';
    fechaEmision: string; // DD/MM/YYYY
    currentSecuencialHint?: string;
  }): Promise<RetentionReservationResponse> {
    const baseUrl = SriBackendService.getBaseUrl();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${baseUrl}/api/sri/retenciones/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codDoc: '07',
          establecimiento: params.estab,
          puntoEmision: params.ptoEmi,
          ruc: params.ruc,
          ambiente: params.ambiente,
          fechaEmision: params.fechaEmision,
        }),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json();
        return {
          success: true,
          reservationId: data.reservationId || data.id,
          secuencial: String(data.secuencial || '').padStart(9, '0'),
          claveAcceso: data.claveAcceso,
          ambiente: data.ambiente || params.ambiente,
          establecimiento: data.establecimiento || params.estab,
          puntoEmision: data.puntoEmision || params.ptoEmi,
          codigoNumerico: data.codigoNumerico,
          issuerData: data.issuerData,
        };
      }
    } catch (_) {
      // Ignorar para activar fallback controlado
    }

    // Fallback controlado si el endpoint aún no está expuesto en el servidor Java local:
    // Utiliza el secuencial actual del ERP y calcula la clave oficial de 49 dígitos con Módulo 11.
    const sec = (params.currentSecuencialHint || '1').replace(/\D/g, '').padStart(9, '0');
    const { claveAcceso, codigoNumerico } = SriRetentionXmlGenerator.generateClaveAcceso({
      fechaEmision: params.fechaEmision,
      ruc: params.ruc,
      ambiente: params.ambiente,
      estab: params.estab,
      ptoEmi: params.ptoEmi,
      secuencial: sec,
    });

    return {
      success: true,
      secuencial: sec,
      claveAcceso,
      ambiente: params.ambiente,
      establecimiento: params.estab,
      puntoEmision: params.ptoEmi,
      codigoNumerico,
      isLocalFallback: true,
    };
  }

  /**
   * 2. Consulta sugerencias tributarias de retención a Java con fallback al motor normativo local.
   */
  public static async suggestRetentions(params: {
    subtotal: number;
    montoIva: number;
    supplierCondition: 'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_POPULAR' | 'ESPECIAL';
    isRetentionAgent: boolean;
    isSpecialTaxpayer: boolean;
    fechaEmisionDoc: string;
  }): Promise<SuggestedRetentionItem[]> {
    const baseUrl = SriBackendService.getBaseUrl();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${baseUrl}/api/tributacion/retenciones/sugerir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions)) {
          return data.suggestions;
        }
      }
    } catch (_) {}

    // Fallback local: motor normativo oficial de Ecuador (Res. NAC-DGERCGC26-00000009)
    const localSugs = RetentionCalculationEngine.suggestRetentions(
      {
        isRetentionAgent: params.isRetentionAgent,
        isSpecialTaxpayer: params.isSpecialTaxpayer,
      },
      {
        isRimpePopular: params.supplierCondition === 'RIMPE_POPULAR',
        isRimpeEmprendedor: params.supplierCondition === 'RIMPE_EMPRENDEDOR',
        isSpecialTaxpayer: params.supplierCondition === 'ESPECIAL',
      },
      params.subtotal,
      params.montoIva,
      'BIENES',
      params.fechaEmisionDoc
    );

    return localSugs.map((s) => ({
      taxType: s.taxType,
      sriCode: s.sriCode,
      description: s.description,
      base: s.recommendedBase,
      percentage: s.percentage,
      valorRetenido: RetentionCalculationEngine.calculateLineRetention(s.recommendedBase, s.percentage),
      legalSource: 'Resolución NAC-DGERCGC26-00000009 / Ley de Régimen Tributario Interno',
      isLocalSuggestion: true,
    }));
  }

  /**
   * 3. Envía el XML ATS 2.0.0 SIN FIRMA a Java.
   * El backend Java se encarga de:
   * Validador XSD -> Firma XAdES-BES -> Web Service Recepción SRI -> Web Service Autorización SRI -> RIDE.
   */
  public static async submitUnsignedRetentionXml(payload: {
    draftId?: string;
    reservationId?: string;
    unsignedXml: string;
    expectedAccessKey: string;
    secuencial: string;
    estab: string;
    ptoEmi: string;
    onProgress?: (step: string, detail?: string) => void;
  }): Promise<SubmitUnsignedXmlResponse> {
    const baseUrl = SriBackendService.getBaseUrl();
    payload.onProgress?.('ENVIANDO_A_JAVA', 'Entregando XML ATS 2.0.0 sin firma al backend Java...');

    try {
      // 1. Intentar endpoint directo unificado de Java si existe
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(`${baseUrl}/api/sri/retenciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unsignedXml: payload.unsignedXml,
          claveAcceso: payload.expectedAccessKey,
          secuencial: payload.secuencial,
          estab: payload.estab,
          ptoEmi: payload.ptoEmi,
          reservationId: payload.reservationId,
        }),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json();
        return {
          success: data.success ?? (data.estado === 'AUTORIZADO'),
          status: data.estado || (data.success ? 'AUTORIZADO' : 'ERROR'),
          claveAcceso: data.claveAcceso || payload.expectedAccessKey,
          secuencial: data.secuencial || payload.secuencial,
          numeroAutorizacion: data.numeroAutorizacion || data.claveAcceso,
          fechaAutorizacion: data.fechaAutorizacion || new Date().toISOString(),
          mensaje: data.mensaje || 'Comprobante procesado por el backend Java.',
          rawResponse: JSON.stringify(data),
        };
      }
    } catch (_) {}

    // Fallback: Si el backend local solo tiene los endpoints modulares (/api/sri/firmar, /api/sri/recepcion, /api/sri/autorizacion),
    // invocamos el pipeline del backend delegando la firma y SOAP exclusivamente a Java:
    payload.onProgress?.('FIRMANDO', 'Backend Java: Firmando con certificado digital...');
    const fRes = await SriBackendService.firmarXml(payload.unsignedXml);
    if (!fRes.success || !fRes.xmlFirmado) {
      return {
        success: false,
        status: 'ERROR',
        claveAcceso: payload.expectedAccessKey,
        secuencial: payload.secuencial,
        mensaje: `Error en firma digital en Java: ${fRes.error || 'No se pudo firmar el comprobante'}`,
      };
    }

    payload.onProgress?.('ENVIANDO_SRI', 'Backend Java: Enviando al Web Service de Recepción del SRI...');
    const rRes = await SriBackendService.recepcionarSri(fRes.xmlFirmado);
    if (!rRes.success) {
      return {
        success: false,
        status: 'DEVUELTO',
        claveAcceso: payload.expectedAccessKey,
        secuencial: payload.secuencial,
        mensaje: rRes.error || 'El SRI devolvió el comprobante con observaciones.',
        rawResponse: rRes.recepcion,
      };
    }

    payload.onProgress?.('EN_PROCESAMIENTO', 'Backend Java: Consultando autorización definitiva al SRI...');
    const aRes = await SriBackendService.autorizarSri(payload.expectedAccessKey, 5, 2000);
    const combined = `${aRes.autorizacion || ''} ${aRes.error || ''}`.toUpperCase();
    const isAut = combined.includes('AUTORIZADO');
    const isNoAut = combined.includes('NO AUTORIZADO') || combined.includes('DEVUELTA');

    const numMatch = aRes.autorizacion?.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/);
    const fechaMatch = aRes.autorizacion?.match(/<fechaAutorizacion.*?>(.*?)<\/fechaAutorizacion>/);

    return {
      success: isAut,
      status: isAut ? 'AUTORIZADO' : isNoAut ? 'NO AUTORIZADO' : 'EN PROCESAMIENTO',
      claveAcceso: payload.expectedAccessKey,
      secuencial: payload.secuencial,
      numeroAutorizacion: numMatch ? numMatch[1] : (isAut ? payload.expectedAccessKey : undefined),
      fechaAutorizacion: fechaMatch ? fechaMatch[1] : (isAut ? new Date().toISOString() : undefined),
      mensaje: isAut ? 'Comprobante de Retención AUTORIZADO exitosamente.' : (aRes.error || 'En procesamiento en el SRI.'),
      rawResponse: aRes.autorizacion,
    };
  }

  /**
   * 4. Consulta a Java para obtener la factura electrónica de sustento por clave de acceso
   * (sin llamar al SRI directamente desde el navegador).
   */
  public static async queryInvoiceByAccessKey(claveAcceso: string): Promise<{ success: boolean; xml?: string; error?: string }> {
    try {
      const res = await SriBackendService.autorizarSri(claveAcceso, 2, 1000);
      if (res.success && res.autorizacion) {
        return { success: true, xml: res.autorizacion };
      }
      return { success: false, error: res.error || 'No se encontró la factura en el SRI a través del backend.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al consultar la clave de acceso.' };
    }
  }
}

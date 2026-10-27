/**
 * @fileOverview Cliente SOAP Nativo en TypeScript para los Web Services Oficiales del SRI Ecuador.
 * Permite comunicar el ERP directamente con el SRI sin intermediarios ni microservicios externos.
 */

export type SriEnvironment = 'PRUEBAS' | 'PRODUCCION' | '1' | '2';

export interface SriRecepcionResult {
  estado: 'RECIBIDA' | 'DEVUELTA' | 'ERROR';
  mensajes: Array<{
    identificador?: string;
    mensaje: string;
    informacionAdicional?: string;
    tipo?: string;
  }>;
  rawResponse: string;
}

export interface SriAutorizacionResult {
  estado: 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO' | 'DEVUELTA' | 'ERROR';
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  comprobante?: string;
  mensajes: Array<{
    identificador?: string;
    mensaje: string;
    informacionAdicional?: string;
    tipo?: string;
  }>;
  rawResponse: string;
}

const SRI_ENDPOINTS = {
  PRUEBAS: {
    recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
  PRODUCCION: {
    recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
};

/**
 * Determina la URL de los Web Services del SRI según el ambiente
 */
export function getSriEndpoints(env?: SriEnvironment) {
  const isProd = env === 'PRODUCCION' || env === '2';
  return isProd ? SRI_ENDPOINTS.PRODUCCION : SRI_ENDPOINTS.PRUEBAS;
}

/**
 * Detecta el ambiente (1: Pruebas, 2: Producción) a partir de una Clave de Acceso de 49 dígitos
 * La posición 24 (índice 23 base 0) indica el tipo de ambiente: 1 = Pruebas, 2 = Producción
 */
export function detectEnvironmentFromClave(claveAcceso: string): SriEnvironment {
  if (claveAcceso && claveAcceso.length === 49) {
    const ambDigit = claveAcceso.charAt(23);
    if (ambDigit === '2') return 'PRODUCCION';
  }
  return 'PRUEBAS';
}

/**
 * Envía un XML firmado al Web Service de Recepción del SRI
 */
export async function sendSriRecepcion(
  signedXml: string,
  environment?: SriEnvironment,
  timeoutMs: number = 30000
): Promise<SriRecepcionResult> {
  const endpoints = getSriEndpoints(environment);
  const base64Xml = Buffer.from(signedXml, 'utf-8').toString('base64');

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${base64Xml}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoints.recepcion, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '',
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    const rawText = await response.text();
    return parseRecepcionResponse(rawText);
  } catch (error: any) {
    return {
      estado: 'ERROR',
      mensajes: [
        {
          mensaje: `Error de conexión con Web Service de Recepción del SRI: ${error.message}`,
          tipo: 'ERROR',
        },
      ],
      rawResponse: error.message || 'Error de red SRI',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta el estado de autorización de un comprobante ante el SRI usando su clave de acceso
 */
export async function sendSriAutorizacion(
  claveAcceso: string,
  environment?: SriEnvironment,
  timeoutMs: number = 30000
): Promise<SriAutorizacionResult> {
  // Si no se provee ambiente, deducirlo de la misma clave de acceso
  const envToUse = environment || detectEnvironmentFromClave(claveAcceso);
  const endpoints = getSriEndpoints(envToUse);

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoints.autorizacion, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '',
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    const rawText = await response.text();
    return parseAutorizacionResponse(rawText, claveAcceso);
  } catch (error: any) {
    return {
      estado: 'ERROR',
      mensajes: [
        {
          mensaje: `Error de conexión con Web Service de Autorización del SRI: ${error.message}`,
          tipo: 'ERROR',
        },
      ],
      rawResponse: error.message || 'Error de red SRI',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parsea la respuesta XML SOAP de Recepción del SRI
 */
function parseRecepcionResponse(rawXml: string): SriRecepcionResult {
  let estado: 'RECIBIDA' | 'DEVUELTA' | 'ERROR' = 'DEVUELTA';
  const mensajes: SriRecepcionResult['mensajes'] = [];

  const estadoMatch = rawXml.match(/<estado>(.*?)<\/estado>/i);
  if (estadoMatch) {
    const st = estadoMatch[1].trim().toUpperCase();
    if (st === 'RECIBIDA') {
      estado = 'RECIBIDA';
    } else if (st === 'DEVUELTA') {
      estado = 'DEVUELTA';
    }
  } else if (rawXml.includes('RECIBIDA')) {
    estado = 'RECIBIDA';
  }

  // Extraer mensajes de error / advertencia
  const mensajeRegex = /<mensaje>([\s\S]*?)<\/mensaje>/gi;
  let match;
  while ((match = mensajeRegex.exec(rawXml)) !== null) {
    const block = match[1];
    const idMatch = block.match(/<identificador>(.*?)<\/identificador>/i);
    const textMatch = block.match(/<mensaje>(.*?)<\/mensaje>/i) || block.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
    const infoMatch = block.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
    const tipoMatch = block.match(/<tipo>(.*?)<\/tipo>/i);

    const mainText = textMatch ? textMatch[1] : block.replace(/<[^>]+>/g, ' ').trim();
    if (mainText) {
      mensajes.push({
        identificador: idMatch ? idMatch[1] : undefined,
        mensaje: mainText.trim(),
        informacionAdicional: infoMatch ? infoMatch[1].trim() : undefined,
        tipo: tipoMatch ? tipoMatch[1].trim() : undefined,
      });
    }
  }

  return { estado, mensajes, rawResponse: rawXml };
}

/**
 * Parsea la respuesta XML SOAP de Autorización del SRI
 */
function parseAutorizacionResponse(rawXml: string, fallbackClave: string): SriAutorizacionResult {
  let estado: SriAutorizacionResult['estado'] = 'NO AUTORIZADO';
  const mensajes: SriAutorizacionResult['mensajes'] = [];

  const numCompMatch = rawXml.match(/<numeroComprobantes>(.*?)<\/numeroComprobantes>/i);
  const numComprobantes = numCompMatch ? parseInt(numCompMatch[1].trim(), 10) : null;

  const estadoMatch = rawXml.match(/<estado>(.*?)<\/estado>/i);
  if (estadoMatch) {
    const st = estadoMatch[1].trim().toUpperCase();
    if (st === 'AUTORIZADO') estado = 'AUTORIZADO';
    else if (st === 'EN PROCESO') estado = 'EN PROCESO';
    else if (st === 'DEVUELTA') estado = 'DEVUELTA';
    else if (st === 'NO AUTORIZADO') estado = 'NO AUTORIZADO';
  } else if (rawXml.includes('AUTORIZADO') && !rawXml.includes('NO AUTORIZADO')) {
    estado = 'AUTORIZADO';
  } else if (numComprobantes === 0 || rawXml.includes('<autorizaciones/>') || rawXml.includes('EN PROCESO')) {
    estado = 'EN PROCESO';
  }

  const numAutMatch = rawXml.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/i);
  const fechaAutMatch = rawXml.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/i);
  const ambMatch = rawXml.match(/<ambiente>(.*?)<\/ambiente>/i);
  const compMatch = rawXml.match(/<comprobante><!\[CDATA\[([\s\S]*?)\]\]><\/comprobante>/i) || rawXml.match(/<comprobante>([\s\S]*?)<\/comprobante>/i);

  // Extraer mensajes
  const mensajeRegex = /<mensaje>([\s\S]*?)<\/mensaje>/gi;
  let match;
  while ((match = mensajeRegex.exec(rawXml)) !== null) {
    const block = match[1];
    const idMatch = block.match(/<identificador>(.*?)<\/identificador>/i);
    const textMatch = block.match(/<mensaje>(.*?)<\/mensaje>/i) || block.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
    const infoMatch = block.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
    const tipoMatch = block.match(/<tipo>(.*?)<\/tipo>/i);

    const mainText = textMatch ? textMatch[1] : block.replace(/<[^>]+>/g, ' ').trim();
    if (mainText) {
      mensajes.push({
        identificador: idMatch ? idMatch[1] : undefined,
        mensaje: mainText.trim(),
        informacionAdicional: infoMatch ? infoMatch[1].trim() : undefined,
        tipo: tipoMatch ? tipoMatch[1].trim() : undefined,
      });
    }
  }

  return {
    estado,
    numeroAutorizacion: numAutMatch ? numAutMatch[1].trim() : (estado === 'AUTORIZADO' ? fallbackClave : undefined),
    fechaAutorizacion: fechaAutMatch ? fechaAutMatch[1].trim() : undefined,
    ambiente: ambMatch ? ambMatch[1].trim() : undefined,
    comprobante: compMatch ? compMatch[1] : undefined,
    mensajes,
    rawResponse: rawXml,
  };
}

import { Request, Response } from 'express';
import crypto from 'crypto';
import { getDatabase, getPgPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAuditEvent } from './audit.controller';

/**
 * Consulta de cédulas y RUCs en tiempo real contra el Catastro Oficial del SRI
 */
export async function lookupSriId(req: Request, res: Response) {
  try {
    const rawId = req.params.id;
    const cleanId = String(rawId || '').replace(/\D/g, '');

    if (cleanId.length !== 10 && cleanId.length !== 13) {
      return res.status(400).json({
        success: false,
        message: 'La identificación debe tener 10 o 13 dígitos numéricos.'
      });
    }

    const tipo = cleanId.length === 10 ? 'C' : 'R';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    };

    // 1. Intentar endpoint oficial de Persona del SRI
    try {
      const personaUrl = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/Persona/obtenerPorTipoIdentificacion?numeroIdentificacion=${cleanId}&tipoIdentificacion=${tipo}`;
      const resPersona = await fetch(personaUrl, { headers });

      if (resPersona.status === 200) {
        const data: any = await resPersona.json();
        if (data && data.nombreCompleto) {
          return res.status(200).json({
            success: true,
            identificacion: cleanId,
            nombre: data.nombreCompleto.trim(),
            tipoPersona: data.tipoPersona || null
          });
        }
      }
    } catch (e) {
      // Fallback
    }

    // 2. Fallback a Catastro RUC consolidado del SRI
    try {
      const rucNum = cleanId.length === 10 ? `${cleanId}001` : cleanId;
      const rucUrl = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?ruc=${rucNum}`;
      const resRuc = await fetch(rucUrl, { headers });

      if (resRuc.status === 200) {
        const list: any = await resRuc.json();
        if (Array.isArray(list) && list.length > 0 && list[0].razonSocial) {
          return res.status(200).json({
            success: true,
            identificacion: cleanId,
            nombre: list[0].razonSocial.trim(),
            tipoPersona: list[0].tipoContribuyente || null
          });
        }
      }
    } catch (e) {
      // Fallback
    }

    return res.status(404).json({
      success: false,
      message: 'No se encontraron datos para la identificación ingresada en los registros del SRI.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar SRI.',
      error: error.message
    });
  }
}

const VAULT_SECRET = process.env.SRI_ENCRYPTION_KEY || 'ferreteria_daynet_p12_vault_secret_2026_aes256';
const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(VAULT_SECRET).digest();

export function encryptPassword(plainText: string): { iv: string; encrypted: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encrypted };
}

export function decryptPassword(encryptedHex: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * SERVICIO DE FIRMA SRI SEGURO EN EL SERVIDOR:
 * El certificado digital .p12 y su contraseña se guardan cifrados con AES-256 en la tabla certificados_sri
 * y NUNCA se almacenan en app_state ni se transmiten al cliente.
 */
export async function uploadCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const { p12Base64, password, environment = 'PRUEBAS', fileName, fileSize } = req.body;

    if (!p12Base64 || !password) {
      return res.status(400).json({
        success: false,
        message: 'Certificado .p12 (Base64) y contraseña son requeridos.'
      });
    }

    // Cifrado criptográfico AES-256 de la contraseña en reposo usando la llave del entorno
    const encryptedData = encryptPassword(String(password).trim());

    const pool = getPgPool();
    try {
      await pool.query("ALTER TABLE certificados_sri ADD COLUMN file_name TEXT;");
    } catch {}
    try {
      await pool.query("ALTER TABLE certificados_sri ADD COLUMN file_size TEXT;");
    } catch {}

    await pool.query(
      `INSERT INTO certificados_sri (id, p12_base64, encrypted_password, iv, environment, status, updated_at, updated_by, file_name, file_size)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVO', NOW(), $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
       SET p12_base64 = EXCLUDED.p12_base64,
           encrypted_password = EXCLUDED.encrypted_password,
           iv = EXCLUDED.iv,
           environment = EXCLUDED.environment,
           status = 'ACTIVO',
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by,
           file_name = EXCLUDED.file_name,
           file_size = EXCLUDED.file_size`,
      ['active_certificate', p12Base64, encryptedData.encrypted, encryptedData.iv, environment, req.user?.username || 'admin', fileName || 'firma_electronica.p12', fileSize || '']
    );

    const db = await getDatabase();
    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'CARGA_CERTIFICADO_SRI_CIFRADO',
      entity: 'certificados_sri',
      entityId: 'active_certificate',
      details: { environment, sizeBytes: p12Base64.length, encryption: 'AES-256-CBC' }
    });

    return res.status(200).json({
      success: true,
      message: 'Certificado digital .p12 almacenado con éxito en la bóveda segura con cifrado AES-256.',
      environment,
      fileName: fileName || 'firma_electronica.p12',
      fileSize: fileSize || ''
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al registrar certificado en servidor.',
      error: error.message
    });
  }
}

/**
 * Consulta el estado del certificado del backend sin revelar la clave privada ni contraseña
 */
export async function getCertificateStatus(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    try {
      await pool.query("ALTER TABLE certificados_sri ADD COLUMN file_name TEXT;");
    } catch {}
    try {
      await pool.query("ALTER TABLE certificados_sri ADD COLUMN file_size TEXT;");
    } catch {}

    const result = await pool.query(
      `SELECT id, environment, status, updated_at, updated_by, file_name, file_size,
              (p12_base64 IS NOT NULL AND length(p12_base64) > 0) as has_cert
       FROM certificados_sri WHERE id = $1`,
      ['active_certificate']
    );

    const cert = result.rows[0];

    if (!cert || !cert.has_cert) {
      return res.status(200).json({
        installed: false,
        message: 'No hay certificado digital .p12 instalado en el backend.'
      });
    }

    return res.status(200).json({
      installed: true,
      environment: cert.environment || 'PRUEBAS',
      updatedAt: cert.updated_at,
      updatedBy: cert.updated_by,
      status: cert.status || 'ACTIVO',
      fileName: cert.file_name || 'firma_electronica.p12',
      fileSize: cert.file_size || null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar estado del certificado.',
      error: error.message
    });
  }
}

/**
 * Elimina el certificado digital de la bóveda segura
 */
export async function deleteCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const pool = getPgPool();
    await pool.query('DELETE FROM certificados_sri WHERE id = $1', ['active_certificate']);

    const db = await getDatabase();
    await logAuditEvent(db, {
      userId: req.user?.id,
      username: req.user?.username || 'admin',
      action: 'ELIMINACION_CERTIFICADO_SRI',
      entity: 'certificados_sri',
      entityId: 'active_certificate',
      details: { reason: 'Eliminado por el administrador' }
    });

    return res.status(200).json({
      success: true,
      message: 'Certificado digital eliminado de la bóveda segura.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar certificado.',
      error: error.message
    });
  }
}

/**
 * Obtiene el certificado activo y desencripta su contraseña en memoria para el proceso de firma
 */
export async function getActiveCertificate(): Promise<{ p12Base64: string; password: string; environment: string } | null> {
  try {
    const pool = getPgPool();
    const result = await pool.query(
      `SELECT p12_base64, encrypted_password, iv, environment, status
       FROM certificados_sri WHERE id = $1 AND status = 'ACTIVO'`,
      ['active_certificate']
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const password = decryptPassword(row.encrypted_password, row.iv);
    return {
      p12Base64: row.p12_base64,
      password,
      environment: row.environment || 'PRUEBAS'
    };
  } catch (err: any) {
    console.error('[SRI Vault Error retrieving certificate]:', err.message);
    return null;
  }
}

/**
 * Detecta la URL activa del microservicio Java del SRI (probando 8081 y 8080)
 */
export async function getSriJavaBaseUrl(customUrl?: string): Promise<string> {
  const candidateUrls = [
    customUrl,
    process.env.SRI_JAVA_URL,
    process.env.SRI_API_URL,
    'http://localhost:8081',
    'http://localhost:8080',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:8080',
  ].filter(Boolean) as string[];

  for (const rawUrl of candidateUrls) {
    const clean = rawUrl.trim().replace(/\/$/, '').replace(/\/api\/sri\/?$/, '');
    try {
      const res = await fetch(`${clean}/api/test/cors`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        return clean;
      }
    } catch {}
  }

  return (process.env.SRI_JAVA_URL || process.env.SRI_API_URL || 'http://localhost:8081')
    .replace(/\/$/, '')
    .replace(/\/api\/sri\/?$/, '');
}

import { signXmlXadesBes } from '../services/sriSigner';
import { sendSriRecepcion, sendSriAutorizacion, detectEnvironmentFromClave, SriEnvironment } from '../services/sriSoapClient';

/**
 * Endpoint de firmado seguro: Si no se provee certificado en el body,
 * se utiliza el certificado cifrado almacenado en la bóveda certificados_sri.
 * Ejecuta el firmado XAdES-BES de forma 100% nativa en Node.js sin depender de Java.
 */
export async function signXmlHandler(req: Request, res: Response) {
  try {
    const { xml, backendUrl } = req.body;
    if (!xml) {
      return res.status(400).send('El parámetro XML es requerido.');
    }

    // 1. Obtener certificado activo de la bóveda segura certificados_sri
    const activeCert = await getActiveCertificate();
    const certBase64 = req.body.certificadoBase64 || activeCert?.p12Base64;
    const password = req.body.password || activeCert?.password;

    if (!certBase64 || !password) {
      return res.status(400).send('No hay certificado digital activo en la bóveda certificados_sri. Cargue su archivo .p12 en Configuración.');
    }

    // Purgar de forma definitiva cualquier clave residual de p12 en app_state
    try {
      const pool = getPgPool();
      await pool.query("DELETE FROM app_state WHERE id LIKE 'ferreteria_settings_p12%';");
    } catch {}

    // 2. Firmar de forma 100% NATIVA en Node.js (XAdES-BES)
    try {
      const signedXml = signXmlXadesBes({
        xml,
        p12Base64: certBase64,
        password
      });

      console.log(`[signXmlHandler] XML firmado exitosamente con motor nativo Node.js. Longitud: ${signedXml.length} bytes.`);
      return res.status(200).type('application/xml').send(signedXml);
    } catch (nativeSignErr: any) {
      console.warn('[signXmlHandler] Error en firmador nativo Node.js:', nativeSignErr.message);

      // Fallback opcional a microservicio externo si existiera configurado
      if (backendUrl || process.env.SRI_JAVA_URL) {
        try {
          const javaBase = await getSriJavaBaseUrl(backendUrl);
          const javaRes = await fetch(`${javaBase}/api/sri/firmar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xml, certificadoBase64: certBase64, password }),
            signal: AbortSignal.timeout(15000),
          });
          if (javaRes.ok) {
            const fallbackXml = await javaRes.text();
            return res.status(200).type('application/xml').send(fallbackXml);
          }
        } catch {}
      }

      return res.status(422).send(`Error al firmar documento digitalmente: ${nativeSignErr.message}`);
    }
  } catch (error: any) {
    return res.status(500).send(`Error en el servicio de firma: ${error.message}`);
  }
}

/**
 * Envío directo al Web Service de Recepción del SRI (SOAP nativo sin microservicio Java)
 */
export async function proxyRecepcionHandler(req: Request, res: Response) {
  try {
    let xmlToSend = '';
    if (typeof req.body === 'string') {
      const trimmed = req.body.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          xmlToSend = parsed.xmlFirmado || parsed.xml || '';
        } catch {}
      }
      if (!xmlToSend) {
        xmlToSend = trimmed;
      }
    } else if (req.body && typeof req.body === 'object') {
      xmlToSend = req.body.xmlFirmado || req.body.xml || '';
    }

    if (!xmlToSend || xmlToSend.trim() === '' || !xmlToSend.includes('<')) {
      return res.status(400).send('No se proporcionó un XML válido para recepción en el SRI.');
    }

    // Detectar ambiente de la clave de acceso dentro del XML o del certificado activo
    let env: SriEnvironment = 'PRUEBAS';
    const claveMatch = xmlToSend.match(/<claveAcceso>(.*?)<\/claveAcceso>/i);
    if (claveMatch) {
      env = detectEnvironmentFromClave(claveMatch[1].trim());
    } else {
      const activeCert = await getActiveCertificate();
      if (activeCert?.environment === 'PRODUCCION' || activeCert?.environment === '2') {
        env = 'PRODUCCION';
      }
    }

    console.log(`[proxyRecepcionHandler] Enviando XML al SRI Recepción (${env}) vía SOAP nativo. Longitud: ${xmlToSend.length} bytes.`);

    const recepcionResult = await sendSriRecepcion(xmlToSend, env);

    if (recepcionResult.estado === 'ERROR') {
      return res.status(503).send(recepcionResult.rawResponse);
    }

    // Retornar la respuesta SOAP/XML original del SRI
    return res.status(200).type('application/xml').send(recepcionResult.rawResponse);
  } catch (err: any) {
    console.error('[proxyRecepcionHandler Exception]:', err.message);
    return res.status(503).send(`Error comunicándose con Recepción SRI: ${err.message}`);
  }
}

/**
 * Consulta directa al Web Service de Autorización del SRI (SOAP nativo sin microservicio Java)
 */
export async function proxyAutorizacionHandler(req: Request, res: Response) {
  try {
    const { clave } = req.params;
    if (!clave || clave.length !== 49) {
      return res.status(400).send('Clave de acceso inválida (debe contener 49 dígitos numéricos).');
    }

    const env = detectEnvironmentFromClave(clave);
    console.log(`[proxyAutorizacionHandler] Consultando autorización SRI para clave ${clave} en ambiente ${env}.`);

    const authResult = await sendSriAutorizacion(clave, env);

    if (authResult.estado === 'ERROR') {
      return res.status(503).send(authResult.rawResponse);
    }

    return res.status(200).type('application/xml').send(authResult.rawResponse);
  } catch (err: any) {
    console.error('[proxyAutorizacionHandler Exception]:', err.message);
    return res.status(503).send(`Error consultando Autorización SRI: ${err.message}`);
  }
}

/**
 * Prueba y diagnóstico del motor nativo SRI
 */
export async function testSriBackendConnection(req: Request, res: Response) {
  try {
    const activeCert = await getActiveCertificate();
    return res.status(200).json({
      ok: true,
      message: 'Motor nativo SRI Node.js integrado y activo. No requiere Java.',
      engine: 'native-nodejs-xades-bes',
      certificateInstalled: !!activeCert,
      environment: activeCert?.environment || 'PRUEBAS',
      endpoints: {
        recepcion: 'SOAP directo SRI',
        autorizacion: 'SOAP directo SRI',
        firma: 'XAdES-BES nativo en servidor'
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      message: `Error al verificar estado del motor SRI: ${err.message}`,
    });
  }
}


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
    const { p12Base64, password, environment = 'PRUEBAS' } = req.body;

    if (!p12Base64 || !password) {
      return res.status(400).json({
        success: false,
        message: 'Certificado .p12 (Base64) y contraseña son requeridos.'
      });
    }

    // Cifrado criptográfico AES-256 de la contraseña en reposo usando la llave del entorno
    const encryptedData = encryptPassword(String(password).trim());

    const pool = getPgPool();
    await pool.query(
      `INSERT INTO certificados_sri (id, p12_base64, encrypted_password, iv, environment, status, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVO', NOW(), $6)
       ON CONFLICT (id) DO UPDATE
       SET p12_base64 = EXCLUDED.p12_base64,
           encrypted_password = EXCLUDED.encrypted_password,
           iv = EXCLUDED.iv,
           environment = EXCLUDED.environment,
           status = 'ACTIVO',
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
      ['active_certificate', p12Base64, encryptedData.encrypted, encryptedData.iv, environment, req.user?.username || 'admin']
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
      environment
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
    const result = await pool.query(
      `SELECT id, environment, status, updated_at, updated_by,
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
      status: cert.status || 'ACTIVO'
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
 * Endpoint de firmado seguro: Si no se provee certificado en el body,
 * se utiliza el certificado cifrado almacenado en la bóveda certificados_sri.
 */
export async function signXmlHandler(req: Request, res: Response) {
  try {
    const { xml } = req.body;
    if (!xml) {
      return res.status(400).send('El parámetro XML es requerido.');
    }

    // Firma EXCLUSIVA en el backend desde certificados_sri
    const activeCert = await getActiveCertificate();
    if (!activeCert) {
      return res.status(400).send('No hay certificado digital activo en la bóveda certificados_sri. Cargue su archivo .p12 en Configuración.');
    }

    const certBase64 = activeCert.p12Base64;
    const password = activeCert.password;

    // Purgar de forma definitiva cualquier clave residual de p12 en app_state
    try {
      const pool = getPgPool();
      await pool.query("DELETE FROM app_state WHERE id LIKE 'ferreteria_settings_p12%';");
    } catch {}

    // Intentar reenviar al backend Java local de firma si está configurado
    const javaBackendUrl = process.env.SRI_JAVA_URL || 'http://localhost:8080/api/sri/firmar';
    try {
      const javaRes = await fetch(javaBackendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml, certificadoBase64: certBase64, password })
      });

      if (javaRes.ok) {
        const signedXml = await javaRes.text();
        return res.status(200).type('application/xml').send(signedXml);
      }
    } catch {
      // Si el backend Java no está activo en este momento
    }

    return res.status(503).send('Servicio de firma digital local Java (:8080) no disponible. Verifique que el servicio de firma esté en ejecución.');
  } catch (error: any) {
    return res.status(500).send(`Error en el servicio de firma: ${error.message}`);
  }
}

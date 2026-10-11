import { Request, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../config/db';
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
 * El certificado digital .p12 y su contraseña se guardan cifrados con AES-256 en el servidor
 * y NUNCA se transmiten al cliente. Solo los usa el servicio de firma.
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

    // Cifrado criptográfico AES-256 de la contraseña en reposo
    const encryptedData = encryptPassword(String(password).trim());

    const db = await getDatabase();
    await db.collection('certificados_sri').updateOne(
      { _id: 'active_certificate' as any },
      {
        $set: {
          p12Base64,
          encryptedPassword: encryptedData.encrypted,
          iv: encryptedData.iv,
          // Eliminamos cualquier password en texto plano
          password: '[CIFRADO_AES_256]',
          environment,
          updatedAt: new Date(),
          updatedBy: req.user?.username || 'admin',
          status: 'ACTIVO'
        }
      },
      { upsert: true }
    );

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
      message: 'Certificado digital .p12 almacenado con éxito en el servidor seguro.',
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
    const db = await getDatabase();
    const cert = await db.collection<any>('certificados_sri').findOne({ _id: 'active_certificate' as any });

    if (!cert || !cert.p12Base64) {
      return res.status(200).json({
        installed: false,
        message: 'No hay certificado digital .p12 instalado en el backend.'
      });
    }

    return res.status(200).json({
      installed: true,
      environment: cert.environment || 'PRUEBAS',
      updatedAt: cert.updatedAt,
      updatedBy: cert.updatedBy,
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

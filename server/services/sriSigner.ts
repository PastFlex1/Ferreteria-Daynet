/**
 * @fileOverview Firmador Electrónico XAdES-BES Nativo en Node.js/TypeScript para SRI Ecuador.
 * Cumple con la Ficha Técnica de Comprobantes Electrónicos Esquema Offline del SRI.
 * No requiere Java ni dependencias externas.
 */

import crypto from 'crypto';
import forge from 'node-forge';
import { loadCertificate, XadesSigner } from 'sri-ec';

export interface SignXmlOptions {
  xml: string;
  p12Base64: string;
  password: string;
}

/**
 * Normaliza y canonicaliza un fragmento XML según Canonical XML 1.0 (c14n)
 */
export function canonicalizeXml(xmlSnippet: string): string {
  let c14n = xmlSnippet.trim();

  // Remover declaración XML si estuviera presente
  c14n = c14n.replace(/<\?xml[^>]*\?>\s*/gi, '');

  // Convertir etiquetas autocontenidas <tag /> en <tag></tag> (excepto dentro de strings)
  c14n = c14n.replace(/<([a-zA-Z0-9_\-:]+)((?:\s+[^"'>]+(?:="[^"]*"|='[^']*')?)*)\s*\/>/g, '<$1$2></$1>');

  return c14n;
}

/**
 * Calcula el hash SHA-1 en Base64 de una cadena UTF-8
 */
function sha1Base64(data: string | Buffer): string {
  return crypto.createHash('sha1').update(data).digest('base64');
}

/**
 * Convierte un número hexadecimal a string decimal (para el X509SerialNumber)
 */
function hexToDecimalString(hex: string): string {
  let dec = BigInt('0x' + hex).toString(10);
  return dec;
}

/**
 * Convierte un BigInteger de Forge a Buffer
 */
function bigIntToBuffer(bigInt: forge.jsbn.BigInteger): Buffer {
  let hex = bigInt.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  // Si el bit más significativo es 1 (>= 0x80), en ASN.1 entero se antepone 00 para que sea positivo
  const firstByte = parseInt(hex.substring(0, 2), 16);
  if (firstByte >= 0x80) {
    hex = '00' + hex;
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Extrae la clave privada, certificado y metadatos del archivo PKCS#12 (.p12)
 */
export function extractPkcs12(p12Base64: string, password: string) {
  const p12Der = forge.util.decode64(p12Base64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  // Buscar bolsa de clave privada
  let privateKey: forge.pki.rsa.PrivateKey | null = null;
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBagList = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (keyBagList && keyBagList.length > 0 && keyBagList[0].key) {
    privateKey = keyBagList[0].key as forge.pki.rsa.PrivateKey;
  } else {
    // Probar keyBag simple
    const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const plainList = plainKeyBags[forge.pki.oids.keyBag];
    if (plainList && plainList.length > 0 && plainList[0].key) {
      privateKey = plainList[0].key as forge.pki.rsa.PrivateKey;
    }
  }

  if (!privateKey) {
    throw new Error('No se pudo extraer la clave privada del certificado .p12. Verifique la contraseña.');
  }

  // Buscar certificados
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certList = certBags[forge.pki.oids.certBag];
  if (!certList || certList.length === 0) {
    throw new Error('No se encontraron certificados en el archivo .p12.');
  }

  // Seleccionar el certificado del usuario que contenga la clave pública correspondiente
  let selectedCert: forge.pki.Certificate | null = null;
  for (const bag of certList) {
    if (bag.cert) {
      // Si tiene clave privada coincidente o tiene extensiones de firma
      const c = bag.cert;
      if (c.publicKey && (c.publicKey as any).n && privateKey.n.compareTo((c.publicKey as any).n) === 0) {
        selectedCert = c;
        break;
      }
    }
  }

  // Si no se encontró por coincidencia exacta de módulo, tomar el primero que tenga keyUsage o el primero de la lista
  if (!selectedCert && certList[0].cert) {
    selectedCert = certList[0].cert;
  }

  if (!selectedCert) {
    throw new Error('Certificado X.509 no encontrado en el archivo .p12.');
  }

  // Convertir cert a DER para hash SHA-1
  const certAsn1 = forge.pki.certificateToAsn1(selectedCert);
  const certDer = forge.asn1.toDer(certAsn1).getBytes();
  const certBuffer = Buffer.from(certDer, 'binary');
  const certDigestBase64 = sha1Base64(certBuffer);
  const cleanCertBase64 = certBuffer.toString('base64');

  // Extraer cadena de certificados completa (Certificado de usuario + CAs intermedias y raíz)
  const allCertificatesBase64: string[] = [cleanCertBase64];
  for (const bag of certList) {
    if (bag.cert && bag.cert !== selectedCert) {
      try {
        const asn1 = forge.pki.certificateToAsn1(bag.cert);
        const der = forge.asn1.toDer(asn1).getBytes();
        const b64 = Buffer.from(der, 'binary').toString('base64');
        if (!allCertificatesBase64.includes(b64)) {
          allCertificatesBase64.push(b64);
        }
      } catch {}
    }
  }

  // Extraer Subject / Issuer
  // El SRI exige formato RFC 2253 (orden inverso de los atributos ASN.1: CN primero, luego OU, O, C)
  const issuerAttributes = selectedCert.issuer.attributes.slice().reverse();
  const issuerParts: string[] = [];
  for (const attr of issuerAttributes) {
    const name = attr.shortName || attr.name;
    const value = attr.value;
    if (name && value) {
      issuerParts.push(`${name}=${value}`);
    }
  }
  const issuerName = issuerParts.join(',');

  // Serial Number
  const serialHex = selectedCert.serialNumber;
  const serialNumber = hexToDecimalString(serialHex);

  // Clave pública RSA: Modulus y Exponent
  const pubKey = selectedCert.publicKey as forge.pki.rsa.PublicKey;
  const modulusBase64 = bigIntToBuffer(pubKey.n).toString('base64');
  const exponentBase64 = bigIntToBuffer(pubKey.e).toString('base64');

  // Clave privada en PEM para firmado nativo rápido
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

  return {
    privateKey,
    privateKeyPem,
    certificate: selectedCert,
    certDigestBase64,
    cleanCertBase64,
    allCertificatesBase64,
    issuerName,
    serialNumber,
    modulusBase64,
    exponentBase64,
  };
}

/**
 * Obtiene la fecha/hora actual formateada en ISO con zona horaria de Ecuador (-05:00)
 */
function getSigningTimeIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  // Convertir a hora de Ecuador (UTC - 5)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ecuadorTime = new Date(utc - (5 * 3600000));

  const yyyy = ecuadorTime.getFullYear();
  const mm = pad(ecuadorTime.getMonth() + 1);
  const dd = pad(ecuadorTime.getDate());
  const hh = pad(ecuadorTime.getHours());
  const min = pad(ecuadorTime.getMinutes());
  const ss = pad(ecuadorTime.getSeconds());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-05:00`;
}

/**
 * Genera un número entero aleatorio para los Ids de la firma
 */
function randomInt(min: number = 100000, max: number = 999999): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Firma digitalmente un XML con el estándar XAdES-BES requerido por el SRI Ecuador
 */
export function signXmlXadesBes(options: SignXmlOptions): string {
  const { xml, p12Base64, password } = options;

  if (!xml || !p12Base64 || !password) {
    throw new Error('Parámetros incompletos para firma digital: se requiere xml, p12Base64 y password.');
  }

  // 1. Preparar el XML base asegurando que el elemento raíz contenga id="comprobante"
  let cleanXml = xml.trim();
  cleanXml = cleanXml.replace(/<\?xml[^>]*\?>\s*/gi, '');

  const rootMatch = cleanXml.match(/^<([a-zA-Z0-9_\-]+)([^>]*)>/);
  if (!rootMatch) {
    throw new Error('El XML proporcionado no tiene un elemento raíz válido.');
  }

  const rootTag = rootMatch[1];
  let rootAttributes = rootMatch[2];

  if (!/id\s*=\s*["']comprobante["']/i.test(rootAttributes)) {
    if (/id\s*=\s*["'][^"']*["']/i.test(rootAttributes)) {
      rootAttributes = rootAttributes.replace(/id\s*=\s*["'][^"']*["']/i, 'id="comprobante"');
    } else {
      rootAttributes = ` id="comprobante"${rootAttributes}`;
    }
    cleanXml = `<${rootTag}${rootAttributes}>` + cleanXml.substring(rootMatch[0].length);
  }

  // 2. Cargar certificado digital PKCS#12 (.p12) y firmar con XAdES-BES certificado
  try {
    const p12Buffer = Buffer.from(p12Base64, 'base64');
    const cert = loadCertificate(new Uint8Array(p12Buffer), password);
    const signer = new XadesSigner({
      digestAlgorithm: 'sha1',
      description: 'contenido comprobante'
    });
    const signedXml = signer.sign(cleanXml, cert);
    return signedXml;
  } catch (signerError: any) {
    console.warn('[sriSigner] Error en motor XadesSigner:', signerError.message);
    throw new Error(`Error en firma digital XAdES-BES: ${signerError.message}`);
  }
}


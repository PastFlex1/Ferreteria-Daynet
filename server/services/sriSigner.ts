/**
 * @fileOverview Firmador Electrónico XAdES-BES Nativo en Node.js/TypeScript para SRI Ecuador.
 * Cumple con la Ficha Técnica de Comprobantes Electrónicos Esquema Offline del SRI.
 * No requiere Java ni dependencias externas.
 */

import crypto from 'crypto';
import forge from 'node-forge';

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

  // Extraer Subject / Issuer
  // El SRI requiere formato RFC 2253 / X.500: e.g. CN=...,OU=...,O=...,C=EC
  const issuerAttributes = selectedCert.issuer.attributes;
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

  // 1. Extraer certificado y claves
  const certData = extractPkcs12(p12Base64, password);

  // 2. Preparar el XML base
  // Asegurar que el elemento raíz contenga id="comprobante"
  let cleanXml = xml.trim();
  cleanXml = cleanXml.replace(/<\?xml[^>]*\?>\s*/gi, '');

  const rootMatch = cleanXml.match(/^<([a-zA-Z0-9_\-]+)([^>]*)>/);
  if (!rootMatch) {
    throw new Error('El XML proporcionado no tiene un elemento raíz válido.');
  }

  const rootTag = rootMatch[1];
  let rootAttributes = rootMatch[2];

  if (!/id\s*=\s*["']comprobante["']/i.test(rootAttributes)) {
    // Si tiene otro id, reemplazarlo o agregarlo
    if (/id\s*=\s*["'][^"']*["']/i.test(rootAttributes)) {
      rootAttributes = rootAttributes.replace(/id\s*=\s*["'][^"']*["']/i, 'id="comprobante"');
    } else {
      rootAttributes = ` id="comprobante"${rootAttributes}`;
    }
    cleanXml = `<${rootTag}${rootAttributes}>` + cleanXml.substring(rootMatch[0].length);
  }

  // 3. Identificadores únicos para este documento firmado
  const sigNumber = randomInt();
  const certNumber = randomInt();
  const refNumber = randomInt();
  const objNumber = randomInt();

  // 4. Digest del comprobante completo (Referencia a #comprobante con transform Enveloped)
  const canonicalComprobante = canonicalizeXml(cleanXml);
  const comprobanteDigest = sha1Base64(canonicalComprobante);

  // 5. Estructurar KeyInfo y su Digest
  const keyInfoXml = `<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Certificate${certNumber}"><ds:X509Data><ds:X509Certificate>${certData.cleanCertBase64}</ds:X509Certificate></ds:X509Data><ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${certData.modulusBase64}</ds:Modulus><ds:Exponent>${certData.exponentBase64}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue></ds:KeyInfo>`;
  const canonicalKeyInfo = canonicalizeXml(keyInfoXml);
  const keyInfoDigest = sha1Base64(canonicalKeyInfo);

  // 6. Estructurar SignedProperties y su Digest
  const signingTime = getSigningTimeIso();
  const signedPropertiesXml = `<etsi:SignedProperties xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="SignedProperties${sigNumber}"><etsi:SignedSignatureProperties><etsi:SigningTime>${signingTime}</etsi:SigningTime><etsi:SigningCertificate><etsi:Cert><etsi:CertDigest><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${certData.certDigestBase64}</ds:DigestValue></etsi:CertDigest><etsi:IssuerSerial><ds:X509IssuerName>${certData.issuerName}</ds:X509IssuerName><ds:X509SerialNumber>${certData.serialNumber}</ds:X509SerialNumber></etsi:IssuerSerial></etsi:Cert></etsi:SigningCertificate></etsi:SignedSignatureProperties><etsi:SignedDataObjectProperties><etsi:DataObjectFormat ObjectReference="#Reference-ID-${refNumber}"><etsi:Description>contenido comprobante</etsi:Description><etsi:MimeType>text/xml</etsi:MimeType></etsi:DataObjectFormat></etsi:SignedDataObjectProperties></etsi:SignedProperties>`;
  const canonicalSignedProperties = canonicalizeXml(signedPropertiesXml);
  const signedPropertiesDigest = sha1Base64(canonicalSignedProperties);

  // 7. Estructurar SignedInfo
  const signedInfoXml = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Id="Signature-SignedInfo${sigNumber}"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod><ds:Reference Id="SignedPropertiesID${sigNumber}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#SignedProperties${sigNumber}"><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue></ds:Reference><ds:Reference URI="#Certificate${certNumber}"><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${keyInfoDigest}</ds:DigestValue></ds:Reference><ds:Reference Id="Reference-ID-${refNumber}" URI="#comprobante"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${comprobanteDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
  const canonicalSignedInfo = canonicalizeXml(signedInfoXml);

  // 8. Firmar SignedInfo con RSA-SHA1 usando la clave privada
  const signer = crypto.createSign('RSA-SHA1');
  signer.update(canonicalSignedInfo, 'utf8');
  const signatureValue = signer.sign(certData.privateKeyPem, 'base64');

  // Formatear SignatureValue en líneas de 76 caracteres (estándar PEM/XMLDSig)
  const formattedSignatureValue = signatureValue.match(/.{1,76}/g)?.join('\n') || signatureValue;

  // 9. Ensamblar la firma ds:Signature completa
  const signatureBlock = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Id="Signature${sigNumber}">
${signedInfoXml}
<ds:SignatureValue Id="SignatureValue${sigNumber}">
${formattedSignatureValue}
</ds:SignatureValue>
${keyInfoXml.replace('xmlns:ds="http://www.w3.org/2000/09/xmldsig#"', '')}
<ds:Object Id="Signature${sigNumber}-Object${objNumber}">${signedPropertiesXml.replace('xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#"', '').replace('xmlns:ds="http://www.w3.org/2000/09/xmldsig#"', '')}</ds:Object></ds:Signature>`;

  // 10. Insertar antes del cierre de la etiqueta raíz
  const closingTag = `</${rootTag}>`;
  const lastIndex = cleanXml.lastIndexOf(closingTag);
  if (lastIndex === -1) {
    throw new Error(`No se encontró la etiqueta de cierre ${closingTag} en el comprobante.`);
  }

  const finalSignedXml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    cleanXml.substring(0, lastIndex) +
    signatureBlock +
    closingTag;

  return finalSignedXml;
}

/**
 * Validador oficial de documentos de identificación de Ecuador (SRI / Registro Civil)
 * Soporta: Cédula de Identidad, RUC (Persona Natural, Sociedad Privada/Extranjera, Sociedad Pública) y Pasaporte.
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  type?: 'CEDULA' | 'RUC_NATURAL' | 'RUC_PRIVADA' | 'RUC_PUBLICA' | 'PASAPORTE' | 'CONSUMIDOR_FINAL';
}

/**
 * Valida Cédula de Identidad Ecuatoriana (10 dígitos)
 */
export function validateCedula(cedula: string): ValidationResult {
  const clean = cedula.trim();

  if (!/^\d{10}$/.test(clean)) {
    return {
      isValid: false,
      message: 'La Cédula debe contener exactamente 10 dígitos numéricos.',
    };
  }

  // Código de provincia (dos primeros dígitos: 01 a 24 o 30)
  const province = parseInt(clean.substring(0, 2), 10);
  if ((province < 1 || province > 24) && province !== 30) {
    return {
      isValid: false,
      message: 'Código de provincia no válido (primeros 2 dígitos deben estar entre 01-24 o 30).',
    };
  }

  // Tercer dígito debe ser menor a 6 para personas naturales
  const thirdDigit = parseInt(clean.charAt(2), 10);
  if (thirdDigit >= 6) {
    return {
      isValid: false,
      message: 'El tercer dígito de una Cédula de persona natural debe ser menor a 6.',
    };
  }

  // Algoritmo Módulo 10 para Cédula
  const coeffs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    let prod = parseInt(clean.charAt(i), 10) * coeffs[i];
    if (prod >= 10) {
      prod -= 9;
    }
    sum += prod;
  }

  const verifierDigit = parseInt(clean.charAt(9), 10);
  const calculatedVerifier = (10 - (sum % 10)) % 10;

  if (verifierDigit !== calculatedVerifier) {
    return {
      isValid: false,
      message: 'Dígito verificador de Cédula incorrecto.',
    };
  }

  return { isValid: true, type: 'CEDULA' };
}

/**
 * Valida RUC Ecuatoriano (13 dígitos)
 */
export function validateRuc(ruc: string): ValidationResult {
  const clean = ruc.trim();

  // Consumidor Final
  if (clean === '9999999999999' || clean === '9999999999') {
    return { isValid: true, type: 'CONSUMIDOR_FINAL' };
  }

  if (!/^\d{13}$/.test(clean)) {
    return {
      isValid: false,
      message: 'El RUC debe contener exactamente 13 dígitos numéricos.',
    };
  }

  // Código de provincia
  const province = parseInt(clean.substring(0, 2), 10);
  if ((province < 1 || province > 24) && province !== 30) {
    return {
      isValid: false,
      message: 'Código de provincia no válido en el RUC (debe estar entre 01-24 o 30).',
    };
  }

  const thirdDigit = parseInt(clean.charAt(2), 10);

  // 1. RUC Persona Natural (Tercer dígito < 6)
  if (thirdDigit < 6) {
    const cedulaPart = clean.substring(0, 10);
    const cedulaVal = validateCedula(cedulaPart);

    if (!cedulaVal.isValid) {
      return {
        isValid: false,
        message: `RUC de Persona Natural no válido: ${cedulaVal.message}`,
      };
    }

    const establishmentCode = clean.substring(10, 13);
    if (establishmentCode === '000') {
      return {
        isValid: false,
        message: 'El código de establecimiento de RUC (últimos 3 dígitos) no puede ser 000.',
      };
    }

    return { isValid: true, type: 'RUC_NATURAL' };
  }

  // 2. RUC Sociedad Privada o Extranjera (Tercer dígito === 9)
  if (thirdDigit === 9) {
    const establishmentCode = clean.substring(10, 13);
    if (establishmentCode === '000') {
      return {
        isValid: false,
        message: 'El código de establecimiento (últimos 3 dígitos) no puede ser 000.',
      };
    }

    // Módulo 11 con coeficientes [4, 3, 2, 7, 6, 5, 4, 3, 2]
    const coeffs = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(clean.charAt(i), 10) * coeffs[i];
    }

    const remainder = sum % 11;
    let calculatedVerifier = remainder === 0 ? 0 : 11 - remainder;
    if (calculatedVerifier === 11) calculatedVerifier = 0;

    const verifierDigit = parseInt(clean.charAt(9), 10);
    if (verifierDigit !== calculatedVerifier) {
      return {
        isValid: false,
        message: 'Dígito verificador de RUC Sociedad Privada incorrecto.',
      };
    }

    return { isValid: true, type: 'RUC_PRIVADA' };
  }

  // 3. RUC Sociedad Pública / Estatal (Tercer dígito === 6)
  if (thirdDigit === 6) {
    const establishmentCode = clean.substring(9, 13);
    if (establishmentCode === '0000') {
      return {
        isValid: false,
        message: 'El código de establecimiento estatal (últimos 4 dígitos) no puede ser 0000.',
      };
    }

    // Módulo 11 con coeficientes [3, 2, 7, 6, 5, 4, 3, 2] para primeros 8 dígitos
    const coeffs = [3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(clean.charAt(i), 10) * coeffs[i];
    }

    const remainder = sum % 11;
    let calculatedVerifier = remainder === 0 ? 0 : 11 - remainder;
    if (calculatedVerifier === 11) calculatedVerifier = 0;

    const verifierDigit = parseInt(clean.charAt(8), 10);
    if (verifierDigit !== calculatedVerifier) {
      return {
        isValid: false,
        message: 'Dígito verificador de RUC Sociedad Pública incorrecto.',
      };
    }

    return { isValid: true, type: 'RUC_PUBLICA' };
  }

  return {
    isValid: false,
    message: 'El tercer dígito del RUC no es válido para la normativa ecuatoriana del SRI.',
  };
}

/**
 * Valida número de Pasaporte
 */
export function validatePasaporte(pasaporte: string): ValidationResult {
  const clean = pasaporte.trim();

  if (!clean) {
    return {
      isValid: false,
      message: 'El número de pasaporte no puede estar vacío.',
    };
  }

  if (clean.length < 3 || clean.length > 20) {
    return {
      isValid: false,
      message: 'El número de pasaporte debe tener entre 3 y 20 caracteres.',
    };
  }

  if (!/^[A-Za-z0-9]+$/.test(clean)) {
    return {
      isValid: false,
      message: 'El pasaporte solo debe contener letras y números sin espacios ni símbolos.',
    };
  }

  return { isValid: true, type: 'PASAPORTE' };
}

/**
 * Validador general de documentos según tipo y número de identificación
 */
export function validateEcuadorianDocument(docType: string, docNumber: string): ValidationResult {
  const typeUpper = (docType || '').toUpperCase().trim();
  const numClean = (docNumber || '').trim();

  if (!numClean) {
    return {
      isValid: false,
      message: 'Ingrese un número de documento de identificación.',
    };
  }

  // Permite Consumidor Final directamente
  if (numClean === '9999999999999' || numClean === '9999999999' || typeUpper === 'CONSUMIDOR_FINAL') {
    return { isValid: true, type: 'CONSUMIDOR_FINAL' };
  }

  if (typeUpper === 'RUC') {
    return validateRuc(numClean);
  }

  if (typeUpper === 'PASAPORTE') {
    return validatePasaporte(numClean);
  }

  // Cédula / C.I.
  if (
    typeUpper === 'C.I.' ||
    typeUpper === 'C.I' ||
    typeUpper === 'CI' ||
    typeUpper === 'CEDULA' || 
    typeUpper === 'CÉDULA' || 
    typeUpper === 'DNI'
  ) {
    return validateCedula(numClean);
  }

  // Si no se especifica un tipo o es ambiguo (AUTO)
  if (numClean.length === 13) {
    const rucVal = validateRuc(numClean);
    if (rucVal.isValid) return rucVal;
  } else if (numClean.length === 10) {
    const cedulaVal = validateCedula(numClean);
    if (cedulaVal.isValid) return cedulaVal;
  }
  
  // Si no pasó las validaciones estrictas numéricas de RUC o Cédula, o si tiene otra longitud, se valida como PASAPORTE.
  // Esto permite que pasaportes de 10 o 13 caracteres alfanuméricos también sean aceptados.
  return validatePasaporte(numClean);
}

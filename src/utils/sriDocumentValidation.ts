/**
 * @fileOverview Validador y motor de diagnóstico de errores documentales del SRI (Ecuador).
 * Implementa las reglas oficiales del SRI para validación de RUC, Cédula, Consumidor Final,
 * secuenciales, fechas extemporáneas y cuadre de tarifas de impuestos.
 */

import { Invoice } from '../types';

export interface SriDocumentDiagnostic {
  esValido: boolean;
  codigoError?: string; // Ej: '45', '43', '56', '70', '35', '47'
  tituloError?: string;
  motivoSri?: string; // Texto oficial devuelto por el Web Service del SRI
  diagnostico?: string; // Diagnóstico amigable para el operador
  solucionSugerida?: string; // Acción recomendada para corregir
  campoAfectado?: 'IDENTIFICACION' | 'FECHA' | 'SECUENCIAL' | 'TOTALES' | 'ESTRUCTURA';
}

/**
 * Validador oficial de Cédula y RUC de la República del Ecuador.
 * Soporta Personas Naturales, Sociedades Privadas y Entidades Públicas.
 */
export function validarCedulaRucEcuador(identificacion: string): {
  valido: boolean;
  tipo: 'CEDULA' | 'RUC_NATURAL' | 'RUC_PRIVADA' | 'RUC_PUBLICA' | 'CONSUMIDOR_FINAL' | 'INVALIDO';
  error?: string;
} {
  const id = (identificacion || '').trim();

  // Consumidor Final
  if (id === '9999999999999') {
    return { valido: true, tipo: 'CONSUMIDOR_FINAL' };
  }

  // Validación de longitud
  if (!/^\d{10}$|^\d{13}$/.test(id)) {
    return {
      valido: false,
      tipo: 'INVALIDO',
      error: 'La identificación debe tener exactamente 10 dígitos (Cédula) o 13 dígitos (RUC).',
    };
  }

  const prov = parseInt(id.substring(0, 2), 10);
  if ((prov < 1 || prov > 24) && prov !== 30) {
    return {
      valido: false,
      tipo: 'INVALIDO',
      error: `Código de provincia inválido (${prov.toString().padStart(2, '0')}). Debe estar entre 01 y 24 o 30.`,
    };
  }

  const tercerDigito = parseInt(id.charAt(2), 10);

  // 1. Cédula de Identidad (10 dígitos)
  if (id.length === 10) {
    if (tercerDigito >= 6) {
      return {
        valido: false,
        tipo: 'INVALIDO',
        error: 'El tercer dígito de una cédula debe ser menor a 6.',
      };
    }

    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let val = parseInt(id.charAt(i), 10) * coeficientes[i];
      if (val >= 10) val -= 9;
      suma += val;
    }
    const residuo = suma % 10;
    const digitoVerificadorEsperado = residuo === 0 ? 0 : 10 - residuo;
    const digitoVerificadorReal = parseInt(id.charAt(9), 10);

    if (digitoVerificadorEsperado !== digitoVerificadorReal) {
      return {
        valido: false,
        tipo: 'INVALIDO',
        error: `Dígito verificador inválido. Esperado: ${digitoVerificadorEsperado}, ingresado: ${digitoVerificadorReal}.`,
      };
    }

    return { valido: true, tipo: 'CEDULA' };
  }

  // 2. RUC (13 dígitos)
  if (id.length === 13) {
    // 2.A RUC Persona Natural (termina en 001 y tercer dígito < 6)
    if (tercerDigito < 6) {
      if (!id.endsWith('001')) {
        return {
          valido: false,
          tipo: 'INVALIDO',
          error: 'El RUC de persona natural debe terminar con el establecimiento 001.',
        };
      }
      // Validar la cédula base (primeros 10 dígitos)
      const cedulaBase = id.substring(0, 10);
      const resCedula = validarCedulaRucEcuador(cedulaBase);
      if (!resCedula.valido) {
        return {
          valido: false,
          tipo: 'INVALIDO',
          error: `RUC Natural inválido: ${resCedula.error}`,
        };
      }
      return { valido: true, tipo: 'RUC_NATURAL' };
    }

    // 2.B RUC Sociedad Privada (tercer dígito = 9, termina en 001)
    if (tercerDigito === 9) {
      if (!id.endsWith('001')) {
        return {
          valido: false,
          tipo: 'INVALIDO',
          error: 'El RUC de sociedad privada debe terminar con el establecimiento 001.',
        };
      }
      const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
      let suma = 0;
      for (let i = 0; i < 9; i++) {
        suma += parseInt(id.charAt(i), 10) * coeficientes[i];
      }
      const residuo = suma % 11;
      const digitoVerificadorEsperado = residuo === 0 ? 0 : 11 - residuo;
      const digitoVerificadorReal = parseInt(id.charAt(9), 10);

      if (digitoVerificadorEsperado !== digitoVerificadorReal) {
        return {
          valido: false,
          tipo: 'INVALIDO',
          error: `Dígito verificador de RUC privado inválido. Esperado: ${digitoVerificadorEsperado}, ingresado: ${digitoVerificadorReal}.`,
        };
      }
      return { valido: true, tipo: 'RUC_PRIVADA' };
    }

    // 2.C RUC Entidad Pública (tercer dígito = 6, termina en 0001)
    if (tercerDigito === 6) {
      if (!id.endsWith('0001')) {
        return {
          valido: false,
          tipo: 'INVALIDO',
          error: 'El RUC de entidad pública debe terminar en 0001.',
        };
      }
      const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
      let suma = 0;
      for (let i = 0; i < 8; i++) {
        suma += parseInt(id.charAt(i), 10) * coeficientes[i];
      }
      const residuo = suma % 11;
      const digitoVerificadorEsperado = residuo === 0 ? 0 : 11 - residuo;
      const digitoVerificadorReal = parseInt(id.charAt(8), 10);

      if (digitoVerificadorEsperado !== digitoVerificadorReal) {
        return {
          valido: false,
          tipo: 'INVALIDO',
          error: `Dígito verificador de RUC público inválido. Esperado: ${digitoVerificadorEsperado}, ingresado: ${digitoVerificadorReal}.`,
        };
      }
      return { valido: true, tipo: 'RUC_PUBLICA' };
    }

    return {
      valido: false,
      tipo: 'INVALIDO',
      error: 'Tercer dígito del RUC no corresponde a persona natural, sociedad privada ni entidad pública.',
    };
  }

  return { valido: false, tipo: 'INVALIDO', error: 'Formato desconocido.' };
}

/**
 * Diagnostica una factura contra las reglas documentales del SRI Ecuador.
 * Identifica si el documento tiene inconsistencias intrínsecas que provocarán
 * o provocaron devolución por el SRI.
 */
export function diagnosticarFacturaSri(
  invoice: Invoice,
  existingInvoices: Invoice[] = []
): SriDocumentDiagnostic {
  // Si ya tiene un mensaje explícito devuelto por el SRI en sriMensaje, extraer código
  if (invoice.sriStatus === 'DEVUELTA' && invoice.sriMensaje) {
    const codeMatch = invoice.sriMensaje.match(/(?:ERROR|CÓDIGO|CODIGO|IDENTIFICADOR)\s*[:#]?\s*(\d+)/i);
    const parsedCode = codeMatch ? codeMatch[1] : undefined;

    if (parsedCode === '45' || parsedCode === '47' || invoice.sriMensaje.toLowerCase().includes('receptor') || invoice.sriMensaje.toLowerCase().includes('identificaci')) {
      return {
        esValido: false,
        codigoError: parsedCode || '45',
        tituloError: 'Identificación del Receptor Inválida',
        motivoSri: invoice.sriMensaje,
        diagnostico: 'El SRI devolvió el comprobante porque el RUC o Cédula del comprador no consta en el catastro tributario activo o tiene dígito verificador incorrecto.',
        solucionSugerida: 'Editar el cliente en la factura, corregir la cédula o RUC e intentar el reenvío.',
        campoAfectado: 'IDENTIFICACION',
      };
    }

    if (parsedCode === '43' || invoice.sriMensaje.toLowerCase().includes('registrada') || invoice.sriMensaje.toLowerCase().includes('secuencial') || invoice.sriMensaje.toLowerCase().includes('duplicad')) {
      return {
        esValido: false,
        codigoError: parsedCode || '43',
        tituloError: 'Secuencial o Clave de Acceso ya Registrada',
        motivoSri: invoice.sriMensaje,
        diagnostico: 'El número secuencial o clave de acceso ya fue emitido y autorizado previamente para este punto de emisión.',
        solucionSugerida: 'Asignar el siguiente secuencial correlativo no utilizado y generar una nueva clave de acceso.',
        campoAfectado: 'SECUENCIAL',
      };
    }

    if (parsedCode === '56' || invoice.sriMensaje.toLowerCase().includes('fecha') || invoice.sriMensaje.toLowerCase().includes('extempor')) {
      return {
        esValido: false,
        codigoError: parsedCode || '56',
        tituloError: 'Fecha de Emisión Extemporánea',
        motivoSri: invoice.sriMensaje,
        diagnostico: 'La fecha de emisión excede las 72 horas de antigüedad permitidas por el SRI o es posterior a la hora actual.',
        solucionSugerida: 'Actualizar la fecha de emisión del documento a la fecha actual.',
        campoAfectado: 'FECHA',
      };
    }

    if (parsedCode === '70' || invoice.sriMensaje.toLowerCase().includes('impuesto') || invoice.sriMensaje.toLowerCase().includes('total') || invoice.sriMensaje.toLowerCase().includes('cuadre')) {
      return {
        esValido: false,
        codigoError: parsedCode || '70',
        tituloError: 'Descuadre de Impuestos / Totales',
        motivoSri: invoice.sriMensaje,
        diagnostico: 'Los totales de base imponible y tarifas de IVA calculadas no cuadran con el valor total del comprobante.',
        solucionSugerida: 'Recalcular bases imponibles con la tarifa de IVA 15% y redondear a 2 decimales.',
        campoAfectado: 'TOTALES',
      };
    }

    return {
      esValido: false,
      codigoError: parsedCode || '35',
      tituloError: 'Devolución Oficial SRI',
      motivoSri: invoice.sriMensaje,
      diagnostico: 'Comprobante devuelto por el Web Service del SRI durante la validación de recepción.',
      solucionSugerida: 'Revisar la estructura y los datos del comprobante para subsanar la observación.',
      campoAfectado: 'ESTRUCTURA',
    };
  }

  // VALIDACIONES PREVENTIVAS DEL DOCUMENTO:

  // 1. Validación de Identificación del Receptor (Error 45 / 47)
  const idCliente = invoice.customer?.docNumber || invoice.customer?.idNumber || '';
  const totalFactura = Number(invoice.total || 0);

  if (idCliente === '9999999999999' && totalFactura > 50) {
    return {
      esValido: false,
      codigoError: '47',
      tituloError: 'Límite Consumidor Final Excedido ($50.00)',
      motivoSri: 'ERROR 47 - NO SE PERMITE FACTURA A CONSUMIDOR FINAL POR VALORES SUPERIORES A $50.00 USD',
      diagnostico: `La factura por $${totalFactura.toFixed(2)} excede el monto máximo de $50.00 USD permitido por la resolución NAC-DGERCGC15-00003236 para Consumidor Final.`,
      solucionSugerida: 'Ingresar los nombres completos y el RUC o Cédula real del cliente adquirente.',
      campoAfectado: 'IDENTIFICACION',
    };
  }

  const checkId = validarCedulaRucEcuador(idCliente);
  if (!checkId.valido && idCliente !== '9999999999999') {
    return {
      esValido: false,
      codigoError: '45',
      tituloError: 'Identificación de Receptor Errónea',
      motivoSri: `ERROR 45 - RUC / CÉDULA DEL RECEPTOR NO CUMPLE ALGORITMO O NO EXISTE EN CATASTRO SRI: ${checkId.error || 'Dígito verificador inválido'}`,
      diagnostico: `La identificación "${idCliente}" ingresada no es una cédula ni RUC válido en el Ecuador (${checkId.error}).`,
      solucionSugerida: 'Corregir el número de identificación del cliente con una cédula de 10 dígitos o RUC de 13 dígitos legítimo.',
      campoAfectado: 'IDENTIFICACION',
    };
  }

  // 2. Validación de Fecha Extemporánea (Error 56)
  if (invoice.createdAt) {
    const fechaEmision = new Date(invoice.createdAt);
    const ahora = new Date();
    const diffMs = ahora.getTime() - fechaEmision.getTime();
    const horasDiff = diffMs / (1000 * 60 * 60);

    if (horasDiff > 72) {
      return {
        esValido: false,
        codigoError: '56',
        tituloError: 'Fecha de Emisión Extemporánea (> 72 horas)',
        motivoSri: `ERROR 56 - FECHA DE EMISIÓN DEL COMPROBANTE ES EXTEMPORÁNEA (${Math.round(horasDiff)} HORAS DE ANTIGÜEDAD)`,
        diagnostico: 'El SRI rechaza comprobantes emitidos con más de 72 horas (3 días) de desfase respecto al momento de transmisión.',
        solucionSugerida: 'Actualizar la fecha de emisión del documento a la fecha y hora de hoy.',
        campoAfectado: 'FECHA',
      };
    }

    if (horasDiff < -0.5) {
      return {
        esValido: false,
        codigoError: '56',
        tituloError: 'Fecha de Emisión Futura Inválida',
        motivoSri: 'ERROR 56 - LA FECHA DE EMISIÓN NO PUEDE SER SUPERIOR A LA FECHA ACTUAL',
        diagnostico: 'La fecha de la factura está programada en el futuro respecto a la hora del servidor SRI.',
        solucionSugerida: 'Ajustar la fecha a la hora actual del sistema.',
        campoAfectado: 'FECHA',
      };
    }
  }

  // 3. Validación de Secuencial Duplicado (Error 43)
  if (invoice.fullNumber && existingInvoices.length > 0) {
    const duplicados = existingInvoices.filter(
      (other) => other.id !== invoice.id && other.fullNumber === invoice.fullNumber
    );
    if (duplicados.length > 0) {
      return {
        esValido: false,
        codigoError: '43',
        tituloError: 'Secuencial Duplicado',
        motivoSri: `ERROR 43 - EL SECUENCIAL ${invoice.fullNumber} YA FUE REGISTRADO EN EL SRI`,
        diagnostico: `El número ${invoice.fullNumber} ya existe en otra transacción registrada. En facturación electrónica cada número debe ser estrictamente único.`,
        solucionSugerida: 'Asignar el siguiente secuencial correlativo disponible.',
        campoAfectado: 'SECUENCIAL',
      };
    }
  }

  // 4. Validación de Descuadre de Totales (Error 70)
  const subtotal = Number(invoice.subtotal || 0);
  const taxTotal = Number(invoice.taxTotal || 0);
  const total = Number(invoice.total || 0);
  const sumaEsperada = Math.round((subtotal + taxTotal) * 100) / 100;
  const diferencia = Math.abs(sumaEsperada - total);

  if (diferencia > 0.03) {
    return {
      esValido: false,
      codigoError: '70',
      tituloError: 'Descuadre Aritmético en Totales',
      motivoSri: `ERROR 70 - TOTAL DE COMPROBANTE (${total.toFixed(2)}) NO COINCIDE CON SUB+IVA (${sumaEsperada.toFixed(2)})`,
      diagnostico: `Existe una discrepancia de $${diferencia.toFixed(2)} entre el subtotal ($${subtotal.toFixed(2)}) + IVA ($${taxTotal.toFixed(2)}) y el total ($${total.toFixed(2)}).`,
      solucionSugerida: 'Recalcular los montos del comprobante y redondear a 2 decimales según estándar SRI.',
      campoAfectado: 'TOTALES',
    };
  }

  // Si pasa todas las validaciones documentales
  return {
    esValido: true,
  };
}

/**
 * Extrae mensajes de error y observaciones desde una respuesta SOAP / XML del SRI.
 */
export function extraerErrorRecepcionSri(rawXml: string): {
  codigo?: string;
  mensaje?: string;
  infoAdicional?: string;
  resumenCompleto: string;
} {
  if (!rawXml) {
    return { resumenCompleto: 'Sin respuesta del servicio SRI' };
  }

  const identM = rawXml.match(/<identificador>(.*?)<\/identificador>/i);
  const msgM = rawXml.match(/<mensaje>(.*?)<\/mensaje>/i);
  const infoM = rawXml.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/i);
  const estadoM = rawXml.match(/<estado>(.*?)<\/estado>/i);

  const codigo = identM ? identM[1].trim() : undefined;
  const mensaje = msgM ? msgM[1].replace(/<[^>]+>/g, '').trim() : undefined;
  const infoAdicional = infoM ? infoM[1].replace(/<[^>]+>/g, '').trim() : undefined;
  const estado = estadoM ? estadoM[1].trim() : 'DEVUELTA';

  let resumen = `${estado}`;
  if (codigo) resumen += ` [Error ${codigo}]`;
  if (mensaje) resumen += `: ${mensaje}`;
  if (infoAdicional) resumen += ` (${infoAdicional})`;

  return {
    codigo,
    mensaje,
    infoAdicional,
    resumenCompleto: resumen,
  };
}

/**
 * Generador de plantillas de facturas devueltas de prueba
 * para que el usuario pueda comprobar inmediatamente la funcionalidad.
 */
export function generarPlantillaFacturaDevuelta(
  tipoError: 'RUC_INVALIDO' | 'CONSUMIDOR_LIMITE' | 'FECHA_EXTEMPORANEA' | 'SECUENCIAL_DUPLICADO' | 'DESCUADRE_IVA'
): Partial<Invoice> {
  const timestamp = Date.now();
  const secStr = Math.floor(100 + Math.random() * 900).toString().padStart(9, '0');

  switch (tipoError) {
    case 'RUC_INVALIDO':
      return {
        number: parseInt(secStr, 10),
        fullNumber: `001-001-${secStr}`,
        createdAt: new Date().toISOString(),
        customer: {
          id: `cust-err-${timestamp}`,
          name: 'Comercializadora San Marcos S.A. (RUC Erróneo)',
          docNumber: '0928374823',
          docType: 'C.I.',
          idNumber: '0928374823', // Cédula con dígito verificador inválido
          idType: 'CEDULA',
          email: 'contacto@sanmarcos.ec',
          phone: '0991234567',
          address: 'Av. 9 de Octubre 412, Guayaquil',
          creditLimit: 0,
          currentBalance: 0,
        },
        subtotal: 120.0,
        discountTotal: 0,
        taxTotal: 18.0,
        total: 138.0,
        paymentMethod: 'TRANSFERENCIA_BANCARIA',
        paymentStatus: 'PAGADA',
        documentType: 'FACTURA',
        sellerName: 'Vendedor Principal',
        sriStatus: 'DEVUELTA',
        sriMensaje:
          'ERROR 45 - RUC / CÉDULA DEL RECEPTOR NO CONSTA EN EL CATASTRO TRIBUTARIO DEL SRI O DÍGITO VERIFICADOR INVÁLIDO [Identificación: 0928374823]',
      };

    case 'CONSUMIDOR_LIMITE':
      return {
        number: parseInt(secStr, 10),
        fullNumber: `001-001-${secStr}`,
        createdAt: new Date().toISOString(),
        customer: {
          id: `cust-cf-${timestamp}`,
          name: 'CONSUMIDOR FINAL',
          docNumber: '9999999999999',
          docType: 'C.I.',
          idNumber: '9999999999999',
          idType: 'CONSUMIDOR_FINAL',
          email: 'consumidor@final.com',
          phone: '0999999999',
          address: 'Ecuador',
          creditLimit: 0,
          currentBalance: 0,
        },
        subtotal: 180.0,
        discountTotal: 0,
        taxTotal: 27.0,
        total: 207.0,
        paymentMethod: 'EFECTIVO',
        paymentStatus: 'PAGADA',
        documentType: 'FACTURA',
        sellerName: 'Caja 1',
        sriStatus: 'DEVUELTA',
        sriMensaje:
          'ERROR 47 - NO SE PUEDE EMITIR COMPROBANTE A CONSUMIDOR FINAL POR UN MONTO SUPERIOR A $50.00 USD SEGÚN RESOLUCIÓN SRI NAC-DGERCGC15-00003236',
      };

    case 'FECHA_EXTEMPORANEA': {
      const fechaVieja = new Date();
      fechaVieja.setDate(fechaVieja.getDate() - 6); // 6 días atrás (> 72 horas)
      return {
        number: parseInt(secStr, 10),
        fullNumber: `001-001-${secStr}`,
        createdAt: fechaVieja.toISOString(),
        customer: {
          id: `cust-fecha-${timestamp}`,
          name: 'Constructora Del Valle Cía. Ltda.',
          docNumber: '1792345678001',
          docType: 'RUC',
          idNumber: '1792345678001',
          idType: 'RUC',
          email: 'info@constructoradelvalle.ec',
          phone: '022345678',
          address: 'Quito, Pichincha',
          creditLimit: 0,
          currentBalance: 0,
        },
        subtotal: 350.0,
        discountTotal: 0,
        taxTotal: 52.5,
        total: 402.5,
        paymentMethod: 'TRANSFERENCIA_BANCARIA',
        paymentStatus: 'PAGADA',
        documentType: 'FACTURA',
        sellerName: 'Vendedor 2',
        sriStatus: 'DEVUELTA',
        sriMensaje:
          'ERROR 56 - FECHA DE EMISIÓN DEL COMPROBANTE ES EXTEMPORÁNEA (SUPERIOR A 72 HORAS DE DESFASE EN RECEPCIÓN OFFLINE SRI)',
      };
    }

    case 'SECUENCIAL_DUPLICADO':
      return {
        number: 1,
        fullNumber: '001-001-000000001',
        createdAt: new Date().toISOString(),
        customer: {
          id: `cust-sec-${timestamp}`,
          name: 'Distribuidora Ferretera El Roble',
          docNumber: '0992345678001',
          docType: 'RUC',
          idNumber: '0992345678001',
          idType: 'RUC',
          email: 'ventas@elroble.ec',
          phone: '042887766',
          address: 'Daule, Guayas',
          creditLimit: 0,
          currentBalance: 0,
        },
        subtotal: 85.0,
        discountTotal: 0,
        taxTotal: 12.75,
        total: 97.75,
        paymentMethod: 'TARJETA_CREDITO',
        paymentStatus: 'PAGADA',
        documentType: 'FACTURA',
        sellerName: 'Caja Principal',
        sriStatus: 'DEVUELTA',
        sriMensaje:
          'ERROR 43 - SECUENCIAL YA REGISTRADO: EL COMPROBANTE 001-001-000000001 YA CONSTA COMO EMITIDO Y AUTORIZADO EN EL SISTEMA SRI',
      };

    case 'DESCUADRE_IVA':
      return {
        number: parseInt(secStr, 10),
        fullNumber: `001-001-${secStr}`,
        createdAt: new Date().toISOString(),
        customer: {
          id: `cust-iva-${timestamp}`,
          name: 'Acabados y Pinturas del Pacífico',
          docNumber: '0993049182001',
          docType: 'RUC',
          idNumber: '0993049182001',
          idType: 'RUC',
          email: 'pacifico@pinturas.ec',
          phone: '0987654321',
          address: 'Manta, Manabí',
          creditLimit: 0,
          currentBalance: 0,
        },
        subtotal: 100.0,
        discountTotal: 0,
        taxTotal: 12.0, // Error: tarifa 12% cuando vigente es 15%
        total: 112.0,
        paymentMethod: 'EFECTIVO',
        paymentStatus: 'PAGADA',
        documentType: 'FACTURA',
        sellerName: 'Vendedor 1',
        sriStatus: 'DEVUELTA',
        sriMensaje:
          'ERROR 70 - TARIFA DE IMPUESTO NO VIGENTE O DESCUADRE EN CÁLCULO DE IVA (SE ESPERA TARIFA 15% = $15.00, RECIBIDO: $12.00)',
      };
  }
}

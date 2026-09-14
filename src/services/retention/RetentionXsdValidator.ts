/**
 * @fileOverview Validador de Esquema XSD y Reglas Tributarias del SRI para Comprobantes
 * de Retención Electrónicos (ATS v2.0.0, codDoc 07).
 * Realiza una validación estricta previa a la firma y envío al SRI para evitar rechazos
 * y consumo innecesario de secuenciales.
 */

import { SRIRetentionData } from '../../types/retention';
import { modulo11 } from '../sriXmlService';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class RetentionXsdValidator {
  /**
   * Ejecuta la validación completa de estructura, tipos, longitudes y reglas de negocio.
   */
  public static validate(data: SRIRetentionData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ==========================================
    // 1. VALIDACIÓN infoTributaria
    // ==========================================
    if (!data.ambiente || !['1', '2'].includes(data.ambiente)) {
      errors.push('infoTributaria: El ambiente debe ser "1" (PRUEBAS) o "2" (PRODUCCIÓN).');
    }

    if (!data.rucEmisor || !/^\d{13}$/.test(data.rucEmisor.trim())) {
      errors.push('infoTributaria: El RUC del emisor debe tener exactamente 13 dígitos numéricos.');
    }

    if (!data.razonSocialEmisor || data.razonSocialEmisor.trim().length === 0) {
      errors.push('infoTributaria: La razón social del emisor es obligatoria.');
    } else if (data.razonSocialEmisor.length > 300) {
      errors.push('infoTributaria: La razón social del emisor excede el límite de 300 caracteres.');
    }

    if (!data.estab || !/^\d{3}$/.test(data.estab.trim())) {
      errors.push('infoTributaria: El código de establecimiento (estab) debe tener exactamente 3 dígitos.');
    }

    if (!data.ptoEmi || !/^\d{3}$/.test(data.ptoEmi.trim())) {
      errors.push('infoTributaria: El punto de emisión (ptoEmi) debe tener exactamente 3 dígitos.');
    }

    if (!data.secuencial || !/^\d{9}$/.test(data.secuencial.trim())) {
      errors.push('infoTributaria: El secuencial debe tener exactamente 9 dígitos numéricos.');
    }

    if (!data.dirMatriz || data.dirMatriz.trim().length === 0) {
      errors.push('infoTributaria: La dirección matriz del emisor es obligatoria.');
    }

    // Validación de Clave de Acceso si ya fue calculada
    if (data.claveAcceso) {
      const cleanClave = data.claveAcceso.trim();
      if (!/^\d{49}$/.test(cleanClave)) {
        errors.push(`infoTributaria: La clave de acceso debe tener exactamente 49 dígitos numéricos (actual: ${cleanClave.length}).`);
      } else {
        // Verificar dígito verificador módulo 11
        const digitoCalculado = modulo11(cleanClave.substring(0, 48));
        const digitoPresente = parseInt(cleanClave.charAt(48), 10);
        if (digitoCalculado !== digitoPresente) {
          errors.push(`infoTributaria: El dígito verificador de la clave de acceso (${digitoPresente}) no coincide con el Módulo 11 oficial (${digitoCalculado}).`);
        }
        // Verificar tipo de comprobante en clave (posiciones 9 y 10 deben ser "07")
        const codDocEnClave = cleanClave.substring(8, 10);
        if (codDocEnClave !== '07') {
          errors.push(`infoTributaria: La clave de acceso debe contener el código de comprobante "07" para retención (encontrado: "${codDocEnClave}").`);
        }
      }
    }

    // ==========================================
    // 2. VALIDACIÓN infoCompRetencion
    // ==========================================
    if (!data.fechaEmision || !/^\d{2}\/\d{2}\/\d{4}$/.test(data.fechaEmision.trim())) {
      errors.push('infoCompRetencion: La fecha de emisión debe tener el formato estricto dd/mm/aaaa.');
    }

    if (!data.periodoFiscal || !/^\d{2}\/\d{4}$/.test(data.periodoFiscal.trim())) {
      errors.push('infoCompRetencion: El período fiscal debe tener el formato estricto mm/aaaa.');
    }

    // REGLA FUNDAMENTAL: TIPOS DE IDENTIFICACIÓN PERMITIDOS
    // 04 = RUC, 05 = Cédula, 06 = Pasaporte, 08 = Identificación del exterior.
    // NUNCA permitir consumidor final '07'.
    const allowedTypes = ['04', '05', '06', '08'];
    if (!allowedTypes.includes(data.tipoIdentificacionSujetoRetenido)) {
      errors.push(`infoCompRetencion: Tipo de identificación "${data.tipoIdentificacionSujetoRetenido}" no permitido para retención. Debe ser 04 (RUC), 05 (Cédula), 06 (Pasaporte) u 08 (Exterior). No se permite Consumidor Final.`);
    }

    if (!data.identificacionSujetoRetenido || data.identificacionSujetoRetenido.trim().length === 0) {
      errors.push('infoCompRetencion: La identificación del sujeto retenido es obligatoria.');
    } else {
      const iden = data.identificacionSujetoRetenido.trim();
      if (iden === '9999999999999' || iden.toLowerCase().includes('consumidor')) {
        errors.push('infoCompRetencion: Prohibido emitir comprobante de retención a "CONSUMIDOR FINAL". Debe identificar al sujeto pasivo.');
      }
      if (data.tipoIdentificacionSujetoRetenido === '04' && !/^\d{13}$/.test(iden)) {
        errors.push('infoCompRetencion: Para tipo 04 (RUC) la identificación debe tener exactamente 13 dígitos numéricos.');
      } else if (data.tipoIdentificacionSujetoRetenido === '05' && !/^\d{10}$/.test(iden)) {
        errors.push('infoCompRetencion: Para tipo 05 (Cédula) la identificación debe tener exactamente 10 dígitos numéricos.');
      }
    }

    if (!data.razonSocialSujetoRetenido || data.razonSocialSujetoRetenido.trim().length === 0) {
      errors.push('infoCompRetencion: La razón social del sujeto retenido es obligatoria.');
    }

    // ==========================================
    // 3. VALIDACIÓN docsSustento
    // ==========================================
    if (!Array.isArray(data.docsSustento) || data.docsSustento.length === 0) {
      errors.push('docsSustento: El comprobante de retención debe incluir al menos un documento de sustento (<docSustento>).');
    } else {
      data.docsSustento.forEach((doc, idx) => {
        const prefix = `docsSustento[${idx + 1}]`;

        if (!doc.codSustento || !/^\d{2}$/.test(doc.codSustento.trim())) {
          errors.push(`${prefix}: codSustento es obligatorio y debe tener 2 dígitos (Tabla 4 ATS).`);
        }

        if (!doc.codDocSustento || !/^\d{2}$/.test(doc.codDocSustento.trim())) {
          errors.push(`${prefix}: codDocSustento es obligatorio y debe tener 2 dígitos (Tabla 3 ATS, ej: 01 Factura).`);
        }

        // El número de sustento debe tener 15 dígitos numéricos (3 estab + 3 ptoEmi + 9 secuencial)
        const cleanNumDoc = (doc.numDocSustento || '').replace(/-/g, '').trim();
        if (!/^\d{15}$/.test(cleanNumDoc)) {
          errors.push(`${prefix}: numDocSustento debe tener exactamente 15 dígitos numéricos (formato 001001000000001). Actual: "${doc.numDocSustento}"`);
        }

        if (!doc.fechaEmisionDocSustento || !/^\d{2}\/\d{2}\/\d{4}$/.test(doc.fechaEmisionDocSustento.trim())) {
          errors.push(`${prefix}: fechaEmisionDocSustento debe tener el formato estricto dd/mm/aaaa.`);
        }

        if (doc.totalSinImpuestos === undefined || doc.totalSinImpuestos < 0) {
          errors.push(`${prefix}: totalSinImpuestos debe ser un valor mayor o igual a 0.`);
        }

        if (doc.importeTotal === undefined || doc.importeTotal < 0) {
          errors.push(`${prefix}: importeTotal debe ser un valor mayor o igual a 0.`);
        }

        // Validación de retenciones dentro del sustento
        if (!Array.isArray(doc.retenciones) || doc.retenciones.length === 0) {
          errors.push(`${prefix}: Debe registrar al menos una línea de retención (<retencion>).`);
        } else {
          doc.retenciones.forEach((ret, retIdx) => {
            const retPrefix = `${prefix}.retenciones[${retIdx + 1}]`;

            if (!['1', '2', '6'].includes(ret.codigo)) {
              errors.push(`${retPrefix}: El código de impuesto "${ret.codigo}" es inválido. Debe ser 1 (RENTA), 2 (IVA) o 6 (ISD).`);
            }

            if (!ret.codigoRetencion || ret.codigoRetencion.trim().length === 0) {
              errors.push(`${retPrefix}: El código de retención del SRI es obligatorio.`);
            }

            if (ret.baseImponible === undefined || ret.baseImponible <= 0) {
              errors.push(`${retPrefix}: La base imponible debe ser mayor a 0.`);
            }

            if (ret.porcentajeRetener === undefined || ret.porcentajeRetener < 0) {
              errors.push(`${retPrefix}: El porcentaje a retener no puede ser negativo.`);
            }

            // Validar coherencia del cálculo
            const base = Number(ret.baseImponible) || 0;
            const pct = Number(ret.porcentajeRetener) || 0;
            const esperado = Math.round((base * pct / 100 + Number.EPSILON) * 100) / 100;
            const actual = Math.round((Number(ret.valorRetenido) + Number.EPSILON) * 100) / 100;

            if (Math.abs(esperado - actual) > 0.02) {
              errors.push(`${retPrefix}: Inconsistencia aritmética en valorRetenido. Se esperaba ${esperado.toFixed(2)} pero se obtuvo ${actual.toFixed(2)}.`);
            }
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

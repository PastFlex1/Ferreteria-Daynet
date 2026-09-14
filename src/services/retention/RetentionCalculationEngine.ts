/**
 * @fileOverview Motor de Cálculo Tributario Decimal para Comprobantes de Retención del SRI.
 * Realiza cálculos exactos en precisión de dos decimales (redondeo bancario estándar)
 * evitando problemas de precisión de punto flotante de JavaScript.
 */

import { DocSustento, RetentionLine, TaxTypeRetention } from '../../types/retention';
import { RetentionCatalogService } from './RetentionCatalogService';

export interface TaxConditionSubject {
  isSpecialTaxpayer?: boolean;
  isRetentionAgent?: boolean;
  isRimpePopular?: boolean;
  isRimpeEmprendedor?: boolean;
  isCompany?: boolean; // Persona Jurídica vs Natural
}

export interface SuggestedRetention {
  taxType: TaxTypeRetention;
  sriCode: string;
  percentage: number;
  description: string;
  recommendedBase: number;
  reason: string;
}

export class RetentionCalculationEngine {
  /**
   * Redondeo bancario exacto a 2 decimales evitando errores de coma flotante.
   */
  public static round2(val: number): number {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calcula el valor retenido de una línea:
   * valorRetenido = round(baseImponible * porcentajeRetener / 100, 2)
   */
  public static calculateLineRetention(baseImponible: number, porcentajeRetener: number): number {
    const base = Number(baseImponible) || 0;
    const pct = Number(porcentajeRetener) || 0;
    if (base <= 0 || pct <= 0) return 0;
    return this.round2((base * pct) / 100);
  }

  /**
   * Recalcula y totaliza todas las retenciones desglosadas por impuesto (Renta, IVA, ISD).
   */
  public static calculateTotals(docsSustento: DocSustento[]): {
    totalRetenidoRenta: number;
    totalRetenidoIva: number;
    totalRetenidoIsd: number;
    totalRetenido: number;
  } {
    let renta = 0;
    let iva = 0;
    let isd = 0;

    for (const doc of docsSustento) {
      if (Array.isArray(doc.retenciones)) {
        for (const ret of doc.retenciones) {
          const valor = this.round2(ret.valorRetenido);
          if (ret.codigo === '1') {
            renta = this.round2(renta + valor);
          } else if (ret.codigo === '2') {
            iva = this.round2(iva + valor);
          } else if (ret.codigo === '6') {
            isd = this.round2(isd + valor);
          }
        }
      }
    }

    const total = this.round2(renta + iva + isd);

    return {
      totalRetenidoRenta: renta,
      totalRetenidoIva: iva,
      totalRetenidoIsd: isd,
      totalRetenido: total,
    };
  }

  /**
   * Sugiere automáticamente las retenciones de Renta e IVA aplicables a una compra,
   * evaluando la condición tributaria del Emisor (agente) y del Proveedor (sujeto retenido)
   * según la normativa vigente del SRI.
   */
  public static suggestRetentions(
    issuerCondition: TaxConditionSubject,
    supplierCondition: TaxConditionSubject,
    subtotal: number,
    ivaAmount: number,
    operationType: 'BIENES' | 'SERVICIOS' | 'HONORARIOS' | 'ARRENDAMIENTOS' = 'BIENES',
    docDate?: string | Date
  ): SuggestedRetention[] {
    const suggestions: SuggestedRetention[] = [];

    // 1. Si el emisor NO es agente de retención ni contribuyente especial,
    // legalmente no está facultado para emitir retenciones (salvo casos de liquidaciones de compra).
    if (!issuerCondition.isRetentionAgent && !issuerCondition.isSpecialTaxpayer) {
      return suggestions;
    }

    // 2. Si el proveedor es Contribuyente Especial, un agente normal NO le retiene
    // (salvo que el emisor sea también Contribuyente Especial o existan convenios específicos).
    if (supplierCondition.isSpecialTaxpayer && !issuerCondition.isSpecialTaxpayer) {
      return suggestions;
    }

    // 3. RETENCIÓN DE IMPUESTO A LA RENTA (AIR)
    if (supplierCondition.isRimpePopular) {
      // Los negocios populares emiten notas de venta; no son objeto de retención de IR en compras normales.
    } else if (supplierCondition.isRimpeEmprendedor) {
      // RIMPE Emprendedor: Código 348 (1%)
      const code348 = RetentionCatalogService.findActiveCode('RENTA', '348', docDate);
      suggestions.push({
        taxType: 'RENTA',
        sriCode: code348 ? code348.sriCode : '348',
        percentage: code348 ? code348.percentage : 1.0,
        description: code348 ? code348.description : 'Contribuyentes RIMPE Emprendedor (1%)',
        recommendedBase: this.round2(subtotal),
        reason: 'Proveedor categorizado en Régimen RIMPE Emprendedor.',
      });
    } else {
      // Régimen General / Sociedades / Personas Naturales
      if (operationType === 'BIENES') {
        // Bienes muebles: Código 312 (1.75%)
        const code312 = RetentionCatalogService.findActiveCode('RENTA', '312', docDate);
        suggestions.push({
          taxType: 'RENTA',
          sriCode: code312 ? code312.sriCode : '312',
          percentage: code312 ? code312.percentage : 1.75,
          description: code312 ? code312.description : 'Transferencia de bienes muebles (1.75%)',
          recommendedBase: this.round2(subtotal),
          reason: 'Adquisición de bienes muebles corporales a proveedor en régimen general.',
        });
      } else if (operationType === 'SERVICIOS') {
        // Servicios donde predomina la mano de obra: Código 343 (2.75% según Res. NAC-DGERCGC26-00000009)
        const code343 = RetentionCatalogService.findActiveCode('RENTA', '343', docDate);
        suggestions.push({
          taxType: 'RENTA',
          sriCode: code343 ? code343.sriCode : '343',
          percentage: code343 ? code343.percentage : 2.75,
          description: code343 ? code343.description : 'Servicios empresariales / mano de obra (2.75%)',
          recommendedBase: this.round2(subtotal),
          reason: 'Prestación de servicios según Res. NAC-DGERCGC26-00000009.',
        });
      } else if (operationType === 'HONORARIOS') {
        // Honorarios profesionales con título: Código 303 (10%)
        const code303 = RetentionCatalogService.findActiveCode('RENTA', '303', docDate);
        suggestions.push({
          taxType: 'RENTA',
          sriCode: code303 ? code303.sriCode : '303',
          percentage: code303 ? code303.percentage : 10.0,
          description: code303 ? code303.description : 'Honorarios profesionales (10%)',
          recommendedBase: this.round2(subtotal),
          reason: 'Servicios profesionales prestados por persona natural.',
        });
      } else if (operationType === 'ARRENDAMIENTOS') {
        // Arrendamiento inmuebles: Código 307 (8%)
        const code307 = RetentionCatalogService.findActiveCode('RENTA', '307', docDate);
        suggestions.push({
          taxType: 'RENTA',
          sriCode: code307 ? code307.sriCode : '307',
          percentage: code307 ? code307.percentage : 8.0,
          description: code307 ? code307.description : 'Arrendamiento de bienes inmuebles (8%)',
          recommendedBase: this.round2(subtotal),
          reason: 'Arrendamiento mercantil o de bienes inmuebles.',
        });
      }
    }

    // 4. RETENCIÓN DE IMPUESTO AL VALOR AGREGADO (IVA)
    // Solo aplica si la factura liquidó IVA > 0
    if (ivaAmount > 0) {
      if (supplierCondition.isSpecialTaxpayer && !issuerCondition.isSpecialTaxpayer) {
        // No se retiene IVA a Contribuyentes Especiales
      } else if (issuerCondition.isRetentionAgent && supplierCondition.isRetentionAgent) {
        // Entre Agentes de Retención: 20% en bienes (código 10) o 50% en servicios (código 11)
        if (operationType === 'BIENES') {
          suggestions.push({
            taxType: 'IVA',
            sriCode: '10',
            percentage: 20.0,
            description: 'Retención del 20% de IVA (Entre Agentes de Retención)',
            recommendedBase: this.round2(ivaAmount),
            reason: 'Operación de compra de bienes entre agentes de retención.',
          });
        } else {
          suggestions.push({
            taxType: 'IVA',
            sriCode: '11',
            percentage: 50.0,
            description: 'Retención del 50% de IVA (Entre Agentes de Retención)',
            recommendedBase: this.round2(ivaAmount),
            reason: 'Operación de servicios entre agentes de retención.',
          });
        }
      } else {
        // Agente de retención a proveedor ordinario / RIMPE
        if (operationType === 'BIENES') {
          // Código 1: 30% en bienes
          suggestions.push({
            taxType: 'IVA',
            sriCode: '1',
            percentage: 30.0,
            description: 'Retención del 30% del IVA (Bienes)',
            recommendedBase: this.round2(ivaAmount),
            reason: 'Adquisición de bienes a proveedor no especial.',
          });
        } else if (operationType === 'SERVICIOS') {
          // Código 2: 70% en servicios
          suggestions.push({
            taxType: 'IVA',
            sriCode: '2',
            percentage: 70.0,
            description: 'Retención del 70% del IVA (Servicios)',
            recommendedBase: this.round2(ivaAmount),
            reason: 'Prestación de servicios gravados con IVA.',
          });
        } else if (operationType === 'HONORARIOS') {
          // Código 3: 100% en honorarios profesionales
          suggestions.push({
            taxType: 'IVA',
            sriCode: '3',
            percentage: 100.0,
            description: 'Retención del 100% del IVA (Honorarios profesionales)',
            recommendedBase: this.round2(ivaAmount),
            reason: 'Servicios profesionales facturados por persona natural.',
          });
        }
      }
    }

    return suggestions;
  }
}

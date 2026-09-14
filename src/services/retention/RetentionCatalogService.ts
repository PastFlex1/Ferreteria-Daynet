/**
 * @fileOverview Servicio del Catálogo Tributario Versionado de Retenciones del SRI (Ecuador).
 * Implementa la Ficha Técnica v2.34, Tablas ATS 3, 4, 18 y 19, y la Resolución NAC-DGERCGC26-00000009
 * (aplicable desde el 1 de marzo de 2026).
 *
 * REGLA FUNDAMENTAL: Los códigos, porcentajes y fechas de vigencia se parametrizan
 * dinámicamente y se almacenan de manera versionada para permitir actualizaciones normativas
 * sin necesidad de modificar el código fuente.
 */

import { RetentionCatalogItem, TaxTypeRetention } from '../../types/retention';

const STORAGE_KEY = 'ferreteria_sri_retention_catalog_v2';

/**
 * Semilla inicial oficial del catálogo de retenciones según normativa vigente SRI.
 */
const DEFAULT_CATALOG: RetentionCatalogItem[] = [
  // ==========================================
  // TABLA 19: RETENCIONES DE IVA (OFICIAL SRI)
  // ==========================================
  {
    id: 'iva-cod-9',
    taxType: 'IVA',
    sriCode: '9',
    description: 'Retención del 10% del IVA (Adquisición de bienes/servicios específicos)',
    percentage: 10.0,
    validFrom: '2020-01-01',
    validTo: null,
    legalSource: 'Ficha Técnica SRI / Resolución NAC-DGERCGC20-00000061',
    active: true,
    category: 'BIENES',
  },
  {
    id: 'iva-cod-10',
    taxType: 'IVA',
    sriCode: '10',
    description: 'Retención del 20% del IVA (Adquisición de bienes entre agentes de retención)',
    percentage: 20.0,
    validFrom: '2020-01-01',
    validTo: null,
    legalSource: 'Ficha Técnica SRI / Resolución NAC-DGERCGC20-00000061',
    active: true,
    category: 'BIENES',
  },
  {
    id: 'iva-cod-1',
    taxType: 'IVA',
    sriCode: '1',
    description: 'Retención del 30% del IVA (Transferencia de bienes muebles de naturaleza corporal)',
    percentage: 30.0,
    validFrom: '2015-01-01',
    validTo: null,
    legalSource: 'Ley de Régimen Tributario Interno / Ficha Técnica SRI',
    active: true,
    category: 'BIENES',
  },
  {
    id: 'iva-cod-11',
    taxType: 'IVA',
    sriCode: '11',
    description: 'Retención del 50% del IVA (Servicios entre contribuyentes especiales y casos normados)',
    percentage: 50.0,
    validFrom: '2020-01-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC20-00000061',
    active: true,
    category: 'SERVICIOS',
  },
  {
    id: 'iva-cod-2',
    taxType: 'IVA',
    sriCode: '2',
    description: 'Retención del 70% del IVA (Prestación de servicios donde predomina la mano de obra)',
    percentage: 70.0,
    validFrom: '2015-01-01',
    validTo: null,
    legalSource: 'Ley de Régimen Tributario Interno / Ficha Técnica SRI',
    active: true,
    category: 'SERVICIOS',
  },
  {
    id: 'iva-cod-3',
    taxType: 'IVA',
    sriCode: '3',
    description: 'Retención del 100% del IVA (Honorarios profesionales, liquidaciones de compra, arrendamiento)',
    percentage: 100.0,
    validFrom: '2015-01-01',
    validTo: null,
    legalSource: 'Ley de Régimen Tributario Interno / Ficha Técnica SRI',
    active: true,
    category: 'HONORARIOS',
  },
  {
    id: 'iva-cod-7',
    taxType: 'IVA',
    sriCode: '7',
    description: 'Retención del 0% del IVA',
    percentage: 0.0,
    validFrom: '2015-01-01',
    validTo: null,
    legalSource: 'Ficha Técnica SRI',
    active: true,
    category: 'OTROS',
  },
  {
    id: 'iva-cod-8',
    taxType: 'IVA',
    sriCode: '8',
    description: 'No procede retención de IVA',
    percentage: 0.0,
    validFrom: '2015-01-01',
    validTo: null,
    legalSource: 'Ficha Técnica SRI',
    active: true,
    category: 'OTROS',
  },

  // =========================================================================
  // TABLA 18: RETENCIONES DE IMPUESTO A LA RENTA (RES. NAC-DGERCGC26-00000009)
  // Vigente desde el 1 de marzo de 2026 y reformas aplicables
  // =========================================================================
  {
    id: 'ir-cod-312-2026',
    taxType: 'RENTA',
    sriCode: '312',
    description: 'Transferencia de bienes muebles de naturaleza corporal (1.75%)',
    percentage: 1.75,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'BIENES',
  },
  {
    id: 'ir-cod-312-hist',
    taxType: 'RENTA',
    sriCode: '312',
    description: 'Transferencia de bienes muebles de naturaleza corporal (Histórico 1.75%)',
    percentage: 1.75,
    validFrom: '2020-01-01',
    validTo: '2026-02-28',
    legalSource: 'Resolución NAC-DGERCGC20-00000020',
    active: true,
    category: 'BIENES',
  },
  {
    id: 'ir-cod-343-2026',
    taxType: 'RENTA',
    sriCode: '343',
    description: 'Servicios empresariales y mano de obra sin título profesional (2.75%)',
    percentage: 2.75,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'SERVICIOS',
  },
  {
    id: 'ir-cod-344-2026',
    taxType: 'RENTA',
    sriCode: '344',
    description: 'Otras retenciones no contempladas en los porcentajes anteriores (2.75%)',
    percentage: 2.75,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'OTROS',
  },
  {
    id: 'ir-cod-303-2026',
    taxType: 'RENTA',
    sriCode: '303',
    description: 'Honorarios profesionales y demás pagos por servicios con título profesional (10%)',
    percentage: 10.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'HONORARIOS',
  },
  {
    id: 'ir-cod-304-2026',
    taxType: 'RENTA',
    sriCode: '304',
    description: 'Servicios donde predomina el intelecto no relacionados con título profesional (8%)',
    percentage: 8.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'SERVICIOS',
  },
  {
    id: 'ir-cod-307-2026',
    taxType: 'RENTA',
    sriCode: '307',
    description: 'Arrendamiento de bienes inmuebles (8%)',
    percentage: 8.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'ARRENDAMIENTOS',
  },
  {
    id: 'ir-cod-308-2026',
    taxType: 'RENTA',
    sriCode: '308',
    description: 'Arrendamiento mercantil de bienes muebles e inmuebles (1.75%)',
    percentage: 1.75,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'ARRENDAMIENTOS',
  },
  {
    id: 'ir-cod-309-2026',
    taxType: 'RENTA',
    sriCode: '309',
    description: 'Seguros y reaseguros (primas y cesiones) (1%)',
    percentage: 1.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'SERVICIOS',
  },
  {
    id: 'ir-cod-320-2026',
    taxType: 'RENTA',
    sriCode: '320',
    description: 'Arrendamiento de bienes muebles (2.75%)',
    percentage: 2.75,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'ARRENDAMIENTOS',
  },
  {
    id: 'ir-cod-322-2026',
    taxType: 'RENTA',
    sriCode: '322',
    description: 'Seguros y reaseguros (1%)',
    percentage: 1.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'SERVICIOS',
  },
  {
    id: 'ir-cod-332-2026',
    taxType: 'RENTA',
    sriCode: '332',
    description: 'Servicio de transporte privado de pasajeros o servicio público o privado de carga (1%)',
    percentage: 1.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'SERVICIOS',
  },
  {
    id: 'ir-cod-346-2026',
    taxType: 'RENTA',
    sriCode: '346',
    description: 'Pagos al exterior a personas naturales o jurídicas no residentes (25%)',
    percentage: 25.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'LRTI / Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'OTROS',
  },
  {
    id: 'ir-cod-338-2026',
    taxType: 'RENTA',
    sriCode: '338',
    description: 'Servicios prestados por artistas nacionales o extranjeros residentes (8%)',
    percentage: 8.0,
    validFrom: '2026-03-01',
    validTo: null,
    legalSource: 'Resolución NAC-DGERCGC26-00000009',
    active: true,
    category: 'HONORARIOS',
  },
  {
    id: 'ir-cod-348-2026',
    taxType: 'RENTA',
    sriCode: '348',
    description: 'Pagos a contribuyentes sujetos al Régimen RIMPE Emprendedor (1%)',
    percentage: 1.0,
    validFrom: '2022-01-01',
    validTo: null,
    legalSource: 'Ley de Desarrollo Económico / Ficha Técnica SRI',
    active: true,
    category: 'BIENES',
  },
  {
    id: 'ir-cod-332-rimpe',
    taxType: 'RENTA',
    sriCode: '332',
    description: 'Transporte prestado por contribuyentes RIMPE (1%)',
    percentage: 1.0,
    validFrom: '2022-01-01',
    validTo: null,
    legalSource: 'Ficha Técnica SRI',
    active: true,
    category: 'SERVICIOS',
  },
  // ==========================================
  // RETENCIONES DE ISD (CÓDIGO IMPUESTO 6)
  // ==========================================
  {
    id: 'isd-cod-4580',
    taxType: 'ISD',
    sriCode: '4580',
    description: 'Impuesto a la Salida de Divisas (5%)',
    percentage: 5.0,
    validFrom: '2024-04-01',
    validTo: null,
    legalSource: 'Ley Orgánica para Enfrentar el Conflicto Armado Interno / SRI',
    active: true,
    category: 'OTROS',
  },
];

/**
 * Catálogo ATS oficial de tipos de sustento (Tabla 4 ATS).
 */
export const SUSTENTOS_TRIBUTARIOS_ATS: Array<{ code: string; label: string }> = [
  { code: '01', label: '01 - Crédito Tributario para declaración de IVA (bienes y servicios)' },
  { code: '02', label: '02 - Costo o Gasto para declaración de Impuesto a la Renta' },
  { code: '03', label: '03 - Activo Fijo - Crédito Tributario para declaración de IVA' },
  { code: '04', label: '04 - Activo Fijo - Costo o Gasto para declaración de Impuesto a la Renta' },
  { code: '05', label: '05 - Liquidación de gastos de viaje, hospedaje y alimentación' },
  { code: '06', label: '06 - Inventario - Crédito Tributario para IVA' },
  { code: '07', label: '07 - Valor retenido en ventas a través de intermediarios' },
  { code: '08', label: '08 - Pagos por reembolso como intermediario' },
  { code: '09', label: '09 - Reembolso por siniestros' },
  { code: '10', label: '10 - Distribución de Dividendos' },
  { code: '00', label: '00 - Casos especiales cuyo sustento no aplica crédito tributario ni costo/gasto' },
];

/**
 * Catálogo ATS oficial de tipos de documentos de sustento (Tabla 3 ATS).
 */
export const TIPOS_DOC_SUSTENTO_ATS: Array<{ code: string; label: string }> = [
  { code: '01', label: '01 - Factura' },
  { code: '02', label: '02 - Nota de Venta' },
  { code: '03', label: '03 - Liquidación de compra de bienes y prestación de servicios' },
  { code: '04', label: '04 - Nota de Crédito' },
  { code: '05', label: '05 - Nota de Débito' },
  { code: '15', label: '15 - Comprobante de venta emitido en el exterior' },
  { code: '41', label: '41 - Comprobante de venta emitido por reembolso' },
];

export class RetentionCatalogService {
  /**
   * Obtiene todos los elementos del catálogo almacenados o la semilla por defecto.
   */
  public static getAll(): RetentionCatalogItem[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('Error al cargar catálogo de retenciones desde localStorage:', e);
    }
    // Si no existe, guardar la semilla oficial
    this.saveAll(DEFAULT_CATALOG);
    return DEFAULT_CATALOG;
  }

  /**
   * Persiste el catálogo en el almacenamiento local.
   */
  public static saveAll(items: RetentionCatalogItem[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch (e) {
      console.error('Error al guardar catálogo de retenciones:', e);
    }
  }

  /**
   * Restablece el catálogo a la semilla oficial del SRI.
   */
  public static resetToDefault(): RetentionCatalogItem[] {
    this.saveAll(DEFAULT_CATALOG);
    return DEFAULT_CATALOG;
  }

  /**
   * Agrega o actualiza un ítem del catálogo versionado.
   */
  public static upsertItem(item: RetentionCatalogItem): void {
    const catalog = this.getAll();
    const idx = catalog.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      catalog[idx] = item;
    } else {
      catalog.push(item);
    }
    this.saveAll(catalog);
  }

  /**
   * Obtiene los códigos de retención aplicables a una fecha de operación dada.
   * Filtra según el intervalo [validFrom, validTo].
   * @param taxType 'RENTA' | 'IVA' | 'ISD'
   * @param dateInput Fecha en formato 'YYYY-MM-DD' o 'DD/MM/YYYY' o Date
   */
  public static getActiveCodes(taxType: TaxTypeRetention, dateInput?: string | Date): RetentionCatalogItem[] {
    const targetDate = this.normalizeDateToIso(dateInput || new Date());
    const catalog = this.getAll();

    const filtered = catalog.filter((item) => {
      if (item.taxType !== taxType || !item.active) return false;

      // Comprobar inicio de vigencia
      if (item.validFrom && targetDate < item.validFrom) {
        return false;
      }
      // Comprobar fin de vigencia
      if (item.validTo && targetDate > item.validTo) {
        return false;
      }
      return true;
    });

    if (filtered.length > 0) {
      return filtered;
    }

    // Fallback de resiliencia: si la fecha no calza en ningún intervalo, retornar todos los ítems activos del tipo
    return catalog.filter((item) => item.taxType === taxType && item.active);
  }

  /**
   * Busca un código específico aplicable a la fecha.
   */
  public static findActiveCode(
    taxType: TaxTypeRetention,
    sriCode: string,
    dateInput?: string | Date
  ): RetentionCatalogItem | undefined {
    const activeList = this.getActiveCodes(taxType, dateInput);
    const found = activeList.find((i) => i.sriCode === sriCode);
    if (found) return found;
    return this.getAll().find((i) => i.taxType === taxType && i.sriCode === sriCode);
  }

  /**
   * Normaliza cualquier formato de fecha a 'YYYY-MM-DD' para comparación lexicográfica ISO.
   */
  public static normalizeDateToIso(input: string | Date): string {
    if (input instanceof Date) {
      return input.toISOString().split('T')[0];
    }
    const str = String(input).trim();
    // Si viene en formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const [dd, mm, yyyy] = str.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    // Si ya viene en formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  }
}

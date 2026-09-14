/**
 * @fileOverview Definición oficial de tipos e interfaces para Comprobantes Electrónicos
 * de Retención (codDoc 07) bajo el esquema ATS versión 2.0.0 del SRI del Ecuador.
 * Cumple con la Ficha Técnica de Comprobantes Electrónicos Esquema Off-line v2.34 y Catálogo ATS.
 */

export type SriAmbiente = '1' | '2'; // 1 = PRUEBAS, 2 = PRODUCCION
export type SriTipoEmision = '1'; // 1 = NORMAL

export type TipoIdentificacionSujetoRetenido = 
  | '04' // RUC
  | '05' // Cédula
  | '06' // Pasaporte
  | '08'; // Identificación del exterior

export type TaxTypeRetention = 'RENTA' | 'IVA' | 'ISD';

export type RetentionState = 
  | 'BORRADOR'
  | 'GENERADO'
  | 'FIRMADO'
  | 'RECIBIDA'
  | 'DEVUELTA'
  | 'EN PROCESAMIENTO'
  | 'AUTORIZADO'
  | 'NO AUTORIZADO'
  | 'ANULADO'
  | 'ERROR';

/**
 * Catálogo de Retenciones versionado por fecha de vigencia y base legal.
 */
export interface RetentionCatalogItem {
  id: string;
  taxType: TaxTypeRetention;
  sriCode: string; // Ej: '312', '343', '1', '2', etc.
  description: string;
  percentage: number; // Ej: 1.75, 30.00, 70.00, etc.
  validFrom: string; // 'YYYY-MM-DD'
  validTo?: string | null; // null si sigue vigente
  legalSource: string; // Ej: 'Resolución NAC-DGERCGC26-00000009'
  active: boolean;
  category?: 'BIENES' | 'SERVICIOS' | 'HONORARIOS' | 'ARRENDAMIENTOS' | 'OTROS';
}

/**
 * Impuesto liquidado en el documento de sustento (IVA, ICE, IRBPNR).
 */
export interface ImpuestoDocSustento {
  codImpuestoDocSustento: string; // '2' = IVA, '3' = ICE, '5' = IRBPNR
  codigoPorcentaje: string; // '0'=0%, '4'=15%, '5'=5%, '2'=12%, etc.
  baseImponible: number;
  tarifa: number; // Ej: 15.00
  valorImpuesto: number;
}

/**
 * Línea de retención individual (AIR, IVA, ISD) aplicada al documento de sustento.
 */
export interface RetentionLine {
  id: string;
  codigo: '1' | '2' | '6'; // 1 = RENTA, 2 = IVA, 6 = ISD
  codigoRetencion: string; // Código oficial SRI del catálogo ATS
  baseImponible: number;
  porcentajeRetener: number;
  valorRetenido: number;
  catalogDescription?: string;
}

/**
 * Forma de pago aplicada al sustento de la retención.
 */
export interface RetentionPayment {
  formaPago: string; // '01' Efectivo, '20' Sist. Financiero, etc.
  total: number;
  plazo?: number;
  unidadTiempo?: string; // 'dias', 'meses'
}

/**
 * Documento de Sustento según la estructura ATS v2.0.0.
 */
export interface DocSustento {
  id: string;
  codSustento: string; // Tabla 4 ATS (ej: '01' Crédito Tributario para IVA)
  codDocSustento: string; // Tabla 3 ATS (ej: '01' Factura, '02' Nota de Venta, '03' Liquidación)
  numDocSustento: string; // 15 dígitos numéricos (ej: '001001000012345')
  fechaEmisionDocSustento: string; // Formato DD/MM/YYYY
  fechaRegistroContable?: string; // Formato DD/MM/YYYY
  numAutDocSustento?: string; // 10, 37 o 49 dígitos
  pagoLocExt: '01' | '02'; // 01 = Local, 02 = Exterior
  tipoRegi?: string; // '01', '02', '03' si pagoLocExt = '02'
  paisEfecPago?: string; // Código de país SRI
  aplicConvDobTrib?: 'SI' | 'NO';
  pagExtSujRetNorLeg?: 'SI' | 'NO';
  totalSinImpuestos: number;
  importeTotal: number;
  impuestosDocSustento: ImpuestoDocSustento[];
  retenciones: RetentionLine[];
  pagos: RetentionPayment[];
}

/**
 * Objeto completo para la generación del Comprobante de Retención Electrónico v2.0.0.
 */
export interface SRIRetentionData {
  // Datos del Emisor (infoTributaria)
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor?: string;
  dirMatriz: string;
  estab: string; // 3 dígitos
  ptoEmi: string; // 3 dígitos
  secuencial: string; // 9 dígitos
  fechaEmision: string; // DD/MM/YYYY
  ambiente: SriAmbiente;
  tipoEmision?: SriTipoEmision;
  claveAcceso?: string; // 49 dígitos calculada
  
  // Regímenes del Emisor
  contribuyenteEspecial?: string;
  obligadoContabilidad: 'SI' | 'NO';
  agenteRetencion?: string; // Número de resolución
  contribuyenteRimpe?: string; // 'CONTRIBUYENTE RÉGIMEN RIMPE' o 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE'
  regimenMicroempresas?: string;

  // Datos del Sujeto Retenido (infoCompRetencion)
  dirEstablecimiento?: string;
  tipoIdentificacionSujetoRetenido: TipoIdentificacionSujetoRetenido;
  tipoSujetoRetenido?: '01' | '02'; // 01=Persona Natural, 02=Sociedad
  parteRel?: 'SI' | 'NO';
  razonSocialSujetoRetenido: string;
  identificacionSujetoRetenido: string;
  periodoFiscal: string; // MM/YYYY

  // Sustentos y Retenciones (docsSustento)
  docsSustento: DocSustento[];

  // Campos adicionales (infoAdicional)
  infoAdicional?: Array<{
    nombre: string;
    valor: string;
  }>;
  emailSujetoRetenido?: string;
  telefonoSujetoRetenido?: string;
  direccionSujetoRetenido?: string;
}

/**
 * Entidad de persistencia en el ERP para un Comprobante de Retención.
 */
export interface RetentionRecord {
  id: string; // formato estab-ptoEmi-secuencial (ej: '001-001-000000001')
  secuencial: string;
  estab: string;
  ptoEmi: string;
  claveAcceso: string;
  fechaEmision: string;
  periodoFiscal: string;
  ambiente: SriAmbiente;
  estado: RetentionState;
  
  // Sujeto Retenido
  sujetoRetenido: {
    tipoIdentificacion: TipoIdentificacionSujetoRetenido;
    identificacion: string;
    razonSocial: string;
    direccion?: string;
    email?: string;
    telefono?: string;
  };

  // Sustento
  docsSustento: DocSustento[];
  
  // Totales
  totalRetenidoRenta: number;
  totalRetenidoIva: number;
  totalRetenidoIsd: number;
  totalRetenido: number;
  
  // Datos SRI
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  xmlGenerado?: string;
  xmlFirmado?: string;
  xmlAutorizado?: string;
  mensajesSri?: Array<{
    identificador?: string;
    mensaje?: string;
    informacionAdicional?: string;
    tipo?: string;
  }>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  anulado?: boolean;
  motivoAnulacion?: string;
}

/**
 * Modelo de Dominio Normalizado para el Borrador de Retención (RetentionDraft).
 * Separa estrictamente el estado del formulario visual de la estructura XML final.
 */
export interface RetentionDraft {
  issuer: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    dirMatriz: string;
    dirEstablecimiento?: string;
    estab: string;
    ptoEmi: string;
    obligadoContabilidad: 'SI' | 'NO';
    contribuyenteEspecial?: string;
    agenteRetencion?: string;
    contribuyenteRimpe?: string;
    regimenMicroempresas?: string;
  };
  retentionInfo: {
    fechaEmision: string; // dd/MM/yyyy
    periodoFiscal: string; // MM/yyyy
    parteRel: 'SI' | 'NO';
    ambiente: SriAmbiente;
    tipoEmision: SriTipoEmision;
    secuencial: string; // 9 dígitos
    claveAcceso?: string; // 49 dígitos recibida de Java
    codigoNumerico?: string;
  };
  retainedSubject: {
    tipoIdentificacion: TipoIdentificacionSujetoRetenido;
    tipoSujetoRetenido?: '01' | '02';
    identificacion: string;
    razonSocial: string;
    direccion?: string;
    email?: string;
    telefono?: string;
  };
  supportDocuments: Array<{
    id: string;
    codSustento: string;
    codDocSustento: string;
    numDocSustento: string; // 15 dígitos
    fechaEmisionDocSustento: string; // dd/MM/yyyy
    fechaRegistroContable?: string; // dd/MM/yyyy
    numAutDocSustento?: string; // 49 dígitos
    pagoLocExt: '01' | '02';
    foreignPayment?: {
      tipoRegi?: string;
      paisEfecPago?: string;
      aplicConvDobTrib?: 'SI' | 'NO';
      pagExtSujRetNorLeg?: 'SI' | 'NO';
    };
    totalSinImpuestos: number;
    importeTotal: number;
    taxes: ImpuestoDocSustento[];
    withholdings: RetentionLine[];
    payments: RetentionPayment[];
  }>;
  additionalInfo?: Array<{
    nombre: string;
    valor: string;
  }>;
  sriReservation?: {
    reservationId?: string;
    secuencial: string;
    claveAcceso: string;
    ambiente: SriAmbiente;
  };
}

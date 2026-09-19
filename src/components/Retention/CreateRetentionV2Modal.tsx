import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  FileText, 
  Percent, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  DollarSign, 
  Send, 
  Sparkles, 
  Loader2, 
  ShieldCheck,
  Calculator,
  User,
  Info,
  UploadCloud,
  FileCheck,
  Search,
  KeyRound,
  FileUp,
  RotateCcw,
  Eye,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { StoreSettings } from '../../types';
import { 
  DocSustento, 
  RetentionLine, 
  RetentionRecord, 
  SRIRetentionData, 
  TipoIdentificacionSujetoRetenido,
  RetentionDraft,
  ImpuestoDocSustento,
  RetentionPayment
} from '../../types/retention';
import { 
  RetentionCatalogService, 
  SUSTENTOS_TRIBUTARIOS_ATS, 
  TIPOS_DOC_SUSTENTO_ATS 
} from '../../services/retention/RetentionCatalogService';
import { RetentionCalculationEngine } from '../../services/retention/RetentionCalculationEngine';
import { RetentionXsdValidator } from '../../services/retention/RetentionXsdValidator';
import { SriInvoiceXmlParser } from '../../services/retention/sriInvoiceXmlParser';
import { SriRetentionXmlGenerator } from '../../services/retention/SriRetentionXmlGenerator';
import { RetentionDraftMapper } from '../../services/retention/retentionDraftMapper';
import { RetentionApiClient } from '../../services/retention/retentionApiClient';
import { Select } from '../Shared/Select';
import { formatCurrency, getEcuadorianDateTime } from '../../utils/formatters';

interface CreateRetentionV2ModalProps {
  onClose: () => void;
  onSuccess: (record: RetentionRecord) => void;
  settings: StoreSettings;
  establishment: string;
  emissionPoint: string;
  secRetention: string;
  purchases?: any[]; // Facturas de compra de ferreteria_purchases
}

export const CreateRetentionV2Modal: React.FC<CreateRetentionV2ModalProps> = ({
  onClose,
  onSuccess,
  settings,
  establishment,
  emissionPoint,
  secRetention,
  purchases = [],
}) => {
  // Estado para la compra seleccionada o sustento manual
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  
  // Estado de Factura Importada por XML o Clave de Acceso
  const [importedInvoice, setImportedInvoice] = useState<{
    fileName?: string;
    razonSocial: string;
    numDoc: string;
    total: number;
    subtotal: number;
    iva: number;
  } | null>(null);
  const [claveAccesoInput, setClaveAccesoInput] = useState<string>('');
  const [isQueryingSri, setIsQueryingSri] = useState<boolean>(false);
  const [showClaveInput, setShowClaveInput] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 0. Datos del Comprobante de Retención
  const [fechaEmisionRetencion, setFechaEmisionRetencion] = useState<string>(
    getEcuadorianDateTime().dateStr
  );
  const [periodoFiscal, setPeriodoFiscal] = useState<string>(
    `${getEcuadorianDateTime().month}/${getEcuadorianDateTime().year}`
  );
  const [parteRel, setParteRel] = useState<'SI' | 'NO'>('NO');
  const ambiente: '1' | '2' = (localStorage.getItem('ferreteria_settings_ambiente') as '1' | '2') || '1';
  const [reservedSecuencial, setReservedSecuencial] = useState<string>(secRetention);
  const [reservedClaveAcceso, setReservedClaveAcceso] = useState<string>('');
  
  // 1. Datos del Sujeto Retenido (Proveedor)
  const [tipoId, setTipoId] = useState<TipoIdentificacionSujetoRetenido>('04');
  const [identificacion, setIdentificacion] = useState<string>('');
  const [razonSocial, setRazonSocial] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [supplierCondition, setSupplierCondition] = useState<'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_POPULAR' | 'ESPECIAL'>('GENERAL');

  // 2. Datos del Documento de Sustento
  const [codSustento, setCodSustento] = useState<string>('01'); // Crédito Tributario IVA
  const [codDocSustento, setCodDocSustento] = useState<string>('01'); // Factura
  const [numDocSustento, setNumDocSustento] = useState<string>(''); // 001-001-000012345
  const [fechaEmisionDocSustento, setFechaEmisionDocSustento] = useState<string>(
    getEcuadorianDateTime().dateStr
  );
  const [fechaRegistroContable, setFechaRegistroContable] = useState<string>('');
  const [numAutDocSustento, setNumAutDocSustento] = useState<string>('');
  const [totalSinImpuestos, setTotalSinImpuestos] = useState<number>(0);
  const [montoIva, setMontoIva] = useState<number>(0);
  const [importeTotal, setImporteTotal] = useState<number>(0);

  // Pago local / exterior
  const [pagoLocExt, setPagoLocExt] = useState<'01' | '02'>('01');
  const [tipoRegi, setTipoRegi] = useState<string>('01');
  const [paisEfecPago, setPaisEfecPago] = useState<string>('593');
  const [aplicConvDobTrib, setAplicConvDobTrib] = useState<'SI' | 'NO'>('NO');
  const [pagExtSujRetNorLeg, setPagExtSujRetNorLeg] = useState<'SI' | 'NO'>('NO');

  // Múltiples Impuestos del Documento de Sustento
  const [impuestosDocSustento, setImpuestosDocSustento] = useState<ImpuestoDocSustento[]>([
    {
      codImpuestoDocSustento: '2',
      codigoPorcentaje: '4', // 15%
      baseImponible: 0,
      tarifa: 15.0,
      valorImpuesto: 0,
    }
  ]);

  // Formas de Pago
  const [pagos, setPagos] = useState<RetentionPayment[]>([
    { formaPago: '20', total: 0 }
  ]);

  // Líneas de Retención (Renta, IVA, ISD)
  const [retenciones, setRetenciones] = useState<RetentionLine[]>([]);

  // Previsualización y estados del proceso de emisión
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<'RESUMEN' | 'XML'>('RESUMEN');
  const [previewXml, setPreviewXml] = useState<string>('');
  const [isCopiedXml, setIsCopiedXml] = useState<boolean>(false);
  const [isEmitting, setIsEmitting] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Catálogos activos según la fecha del documento
  const activeIrCodes = RetentionCatalogService.getActiveCodes('RENTA', fechaEmisionDocSustento);
  const activeIvaCodes = RetentionCatalogService.getActiveCodes('IVA', fechaEmisionDocSustento);
  const activeIsdCodes = RetentionCatalogService.getActiveCodes('ISD', fechaEmisionDocSustento);

  // Actualizar periodo fiscal automáticamente al cambiar la fecha de emisión del sustento
  useEffect(() => {
    if (fechaEmisionDocSustento) {
      const parts = fechaEmisionDocSustento.split('-');
      if (parts.length >= 2) {
        setPeriodoFiscal(`${parts[1].padStart(2, '0')}/${parts[0]}`);
      }
    }
  }, [fechaEmisionDocSustento]);

  // Procesar archivo o contenido XML de una factura del SRI con seguridad XXE
  const handleXmlImport = (xmlContent: string, fileName?: string) => {
    const result = SriInvoiceXmlParser.parseXml(xmlContent);
    if (!result.success) {
      setErrorMsg(`Error al procesar el archivo XML: ${result.error || 'Estructura inválida o no corresponde a una factura electrónica SRI.'}`);
      return;
    }
    setErrorMsg(null);
    setSelectedPurchaseId('');

    // DEBUG: Ver qué datos extrajo el parser (abre la consola del navegador F12)
    console.log('[RetenciónXML] Datos extraídos del XML:', {
      proveedor: result.supplier,
      factura: {
        codDoc: result.invoice.codDocSustento,
        numero: result.invoice.formattedNumber,
        fecha: result.invoice.isoDate,
        subtotal: result.invoice.totalSinImpuestos,
        iva: result.invoice.montoIva,
        total: result.invoice.importeTotal,
      }
    });

    // 1. Datos del Proveedor
    setTipoId(result.supplier.tipoId);
    setIdentificacion(result.supplier.ruc);
    setRazonSocial(result.supplier.razonSocial);
    setDireccion(result.supplier.direccion);
    setEmail(result.supplier.email);
    setSupplierCondition(result.supplier.condition);

    // 2. Datos de la Factura Retenida
    setCodDocSustento(result.invoice.codDocSustento);
    setNumDocSustento(result.invoice.formattedNumber);
    setNumAutDocSustento(result.invoice.numAutorizacion || result.invoice.claveAcceso);
    setFechaEmisionDocSustento(result.invoice.isoDate);
    setTotalSinImpuestos(result.invoice.totalSinImpuestos);
    setMontoIva(result.invoice.montoIva);
    setImporteTotal(result.invoice.importeTotal);

    // 3. Múltiples Impuestos de Sustento
    if (result.invoice.impuestos && result.invoice.impuestos.length > 0) {
      setImpuestosDocSustento(result.invoice.impuestos);
    } else {
      setImpuestosDocSustento([
        {
          codImpuestoDocSustento: '2',
          codigoPorcentaje: result.invoice.tarifaIva === 15 ? '4' : '0',
          baseImponible: result.invoice.totalSinImpuestos,
          tarifa: result.invoice.tarifaIva,
          valorImpuesto: result.invoice.montoIva,
        }
      ]);
    }

    // 4. Formas de Pago
    if (result.invoice.pagos && result.invoice.pagos.length > 0) {
      setPagos(result.invoice.pagos);
    } else {
      setPagos([{ formaPago: result.invoice.formaPago || '20', total: result.invoice.importeTotal }]);
    }

    // 5. Sugerencia inteligente de retenciones
    autoSuggestRetentions(
      result.invoice.totalSinImpuestos,
      result.invoice.montoIva,
      { regimen: result.supplier.condition },
      result.invoice.isoDate,
      result.supplier.condition
    );

    setImportedInvoice({
      fileName,
      razonSocial: result.supplier.razonSocial,
      numDoc: result.invoice.formattedNumber,
      total: result.invoice.importeTotal,
      subtotal: result.invoice.totalSinImpuestos,
      iva: result.invoice.montoIva,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErrorMsg('Solo se permiten archivos con extensión .xml');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleXmlImport(text, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.xml')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          handleXmlImport(text, file.name);
        }
      };
      reader.readAsText(file);
    } else {
      setErrorMsg('Por favor arrastre un archivo .xml válido emitido por el SRI.');
    }
  };

  // Consultar factura al backend de Java por clave de acceso
  const handleQuerySriClave = async () => {
    const cleanClave = claveAccesoInput.trim().replace(/\D/g, '');
    if (cleanClave.length !== 49) {
      setErrorMsg('La clave de acceso del SRI debe tener exactamente 49 dígitos numéricos.');
      return;
    }

    setIsQueryingSri(true);
    setErrorMsg(null);

    try {
      const res = await RetentionApiClient.queryInvoiceByAccessKey(cleanClave);
      if (res.success && res.xml) {
        handleXmlImport(res.xml, `Factura-SRI-${cleanClave.slice(24, 39)}.xml`);
        setClaveAccesoInput('');
        setShowClaveInput(false);
      } else {
        setErrorMsg(`No se pudo obtener la factura desde el backend Java: ${res.error || 'Respuesta vacía'}`);
      }
    } catch (err: any) {
      setErrorMsg(`Error al consultar clave de acceso: ${err.message || err}`);
    } finally {
      setIsQueryingSri(false);
    }
  };

  // Al seleccionar una compra registrada en el sistema
  useEffect(() => {
    if (!selectedPurchaseId) return;

    const purchase = purchases.find((p: any) => p.id === selectedPurchaseId);
    if (purchase) {
      setImportedInvoice(null);
      const sup = purchase.supplier || {};
      const taxId = (sup.taxId || sup.ruc || '').trim();
      
      // Determinar tipo de ID
      if (taxId.length === 13) setTipoId('04');
      else if (taxId.length === 10) setTipoId('05');
      else setTipoId('06');

      setIdentificacion(taxId);
      setRazonSocial(sup.name || sup.legalName || 'PROVEEDOR');
      setDireccion(sup.address || 'MATRIZ');
      setEmail(sup.email || '');

      // Extraer datos del documento
      const rawNum = (purchase.invoiceNumber || purchase.id || '').replace(/\D/g, '');
      const paddedNum = rawNum.padStart(15, '0').slice(-15);
      const formattedNum = `${paddedNum.slice(0, 3)}-${paddedNum.slice(3, 6)}-${paddedNum.slice(6)}`;
      setNumDocSustento(formattedNum);

      let purchaseIsoDate = fechaEmisionDocSustento;
      if (purchase.purchaseDate) {
        purchaseIsoDate = purchase.purchaseDate.substring(0, 10);
        setFechaEmisionDocSustento(purchaseIsoDate);
      }

      const sub = Number(purchase.subtotal) || 0;
      const iva = Number(purchase.taxTotal) || 0;
      const tot = Number(purchase.total) || (sub + iva);

      setTotalSinImpuestos(sub);
      setMontoIva(iva);
      setImporteTotal(tot);

      setImpuestosDocSustento([
        {
          codImpuestoDocSustento: '2',
          codigoPorcentaje: '4', // 15%
          baseImponible: sub,
          tarifa: 15.0,
          valorImpuesto: iva,
        }
      ]);

      setPagos([
        { formaPago: '20', total: tot }
      ]);

      // Sugerir retenciones automáticamente
      autoSuggestRetentions(sub, iva, sup, purchaseIsoDate);
    }
  }, [selectedPurchaseId]);

  // Sugerencia inteligente de retenciones (consulta API Java con fallback normativo)
  const autoSuggestRetentions = async (
    sub: number, 
    iva: number, 
    supData?: any, 
    overrideDate?: string,
    overrideCondition?: 'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_POPULAR' | 'ESPECIAL'
  ) => {
    const cond = overrideCondition || supplierCondition;
    const suggested = await RetentionApiClient.suggestRetentions({
      subtotal: sub,
      montoIva: iva,
      supplierCondition: cond,
      isRetentionAgent: settings.isRetentionAgent ?? true,
      isSpecialTaxpayer: !!settings.specialTaxpayerNumber,
      fechaEmisionDoc: overrideDate || fechaEmisionDocSustento,
    });

    const newLines: RetentionLine[] = suggested.map((s, idx) => ({
      id: `sug-${Date.now()}-${idx}`,
      codigo: s.taxType === 'RENTA' ? '1' : s.taxType === 'IVA' ? '2' : '6',
      codigoRetencion: s.sriCode,
      baseImponible: s.base,
      porcentajeRetener: s.percentage,
      valorRetenido: s.valorRetenido,
      catalogDescription: s.description,
    }));

    setRetenciones(newLines);
  };

  // Agregar una línea de retención manual (Renta, IVA o ISD)
  const handleAddLine = (tipo: 'RENTA' | 'IVA' | 'ISD') => {
    if (tipo === 'RENTA') {
      const defaultCode = activeIrCodes[0] || { sriCode: '312', percentage: 1.75, description: 'Bienes muebles (1.75%)' };
      const base = totalSinImpuestos > 0 ? totalSinImpuestos : 100;
      setRetenciones([
        ...retenciones,
        {
          id: `line-${Date.now()}`,
          codigo: '1',
          codigoRetencion: defaultCode.sriCode,
          baseImponible: base,
          porcentajeRetener: defaultCode.percentage,
          valorRetenido: RetentionCalculationEngine.calculateLineRetention(base, defaultCode.percentage),
          catalogDescription: defaultCode.description,
        },
      ]);
    } else if (tipo === 'IVA') {
      const defaultCode = activeIvaCodes.find((c) => c.sriCode === '1') || { sriCode: '1', percentage: 30.0, description: '30% IVA Bienes' };
      const base = montoIva > 0 ? montoIva : 15;
      setRetenciones([
        ...retenciones,
        {
          id: `line-${Date.now()}`,
          codigo: '2',
          codigoRetencion: defaultCode.sriCode,
          baseImponible: base,
          porcentajeRetener: defaultCode.percentage,
          valorRetenido: RetentionCalculationEngine.calculateLineRetention(base, defaultCode.percentage),
          catalogDescription: defaultCode.description,
        },
      ]);
    } else {
      const defaultCode = activeIsdCodes[0] || { sriCode: '4580', percentage: 5.0, description: 'Impuesto a la Salida de Divisas (5%)' };
      const base = totalSinImpuestos > 0 ? totalSinImpuestos : 100;
      setRetenciones([
        ...retenciones,
        {
          id: `line-${Date.now()}`,
          codigo: '6',
          codigoRetencion: defaultCode.sriCode,
          baseImponible: base,
          porcentajeRetener: defaultCode.percentage,
          valorRetenido: RetentionCalculationEngine.calculateLineRetention(base, defaultCode.percentage),
          catalogDescription: defaultCode.description,
        },
      ]);
    }
  };

  // Modificar línea de retención
  const handleUpdateLine = (id: string, updates: Partial<RetentionLine>) => {
    setRetenciones((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, ...updates };

        // Si cambió el código de retención, actualizar porcentaje y descripción
        if (updates.codigoRetencion && updates.codigoRetencion !== line.codigoRetencion) {
          const taxType = updated.codigo === '1' ? 'RENTA' : updated.codigo === '2' ? 'IVA' : 'ISD';
          const catalogItem = RetentionCatalogService.findActiveCode(taxType, updates.codigoRetencion, fechaEmisionDocSustento);
          if (catalogItem) {
            updated.porcentajeRetener = catalogItem.percentage;
            updated.catalogDescription = catalogItem.description;
          }
        }

        // Recalcular valor retenido de forma decimal exacta
        updated.valorRetenido = RetentionCalculationEngine.calculateLineRetention(
          updated.baseImponible,
          updated.porcentajeRetener
        );

        return updated;
      })
    );
  };

  // Eliminar línea
  const handleRemoveLine = (id: string) => {
    setRetenciones((prev) => prev.filter((line) => line.id !== id));
  };

  // Gestión de múltiples impuestos de sustento
  const handleAddTaxLine = () => {
    setImpuestosDocSustento([
      ...impuestosDocSustento,
      {
        codImpuestoDocSustento: '2',
        codigoPorcentaje: '0', // 0%
        baseImponible: 0,
        tarifa: 0,
        valorImpuesto: 0,
      }
    ]);
  };

  const handleUpdateTaxLine = (index: number, updates: Partial<ImpuestoDocSustento>) => {
    setImpuestosDocSustento((prev) => {
      const next = [...prev];
      const cur = { ...next[index], ...updates };
      if (updates.codigoPorcentaje !== undefined) {
        if (cur.codigoPorcentaje === '4') cur.tarifa = 15;
        else if (cur.codigoPorcentaje === '5') cur.tarifa = 5;
        else if (cur.codigoPorcentaje === '2') cur.tarifa = 12;
        else if (cur.codigoPorcentaje === '0') cur.tarifa = 0;
      }
      cur.valorImpuesto = RetentionCalculationEngine.round2((cur.baseImponible * cur.tarifa) / 100);
      next[index] = cur;

      // Actualizar totales generales
      const newSub = RetentionCalculationEngine.round2(next.reduce((acc, t) => acc + t.baseImponible, 0));
      const newIva = RetentionCalculationEngine.round2(next.filter((t) => t.codImpuestoDocSustento === '2').reduce((acc, t) => acc + t.valorImpuesto, 0));
      setTotalSinImpuestos(newSub);
      setMontoIva(newIva);
      setImporteTotal(RetentionCalculationEngine.round2(newSub + newIva));

      return next;
    });
  };

  const handleRemoveTaxLine = (index: number) => {
    if (impuestosDocSustento.length <= 1) return;
    setImpuestosDocSustento((prev) => prev.filter((_, i) => i !== index));
  };

  // Gestión de Formas de Pago
  const handleAddPayment = () => {
    setPagos([
      ...pagos,
      { formaPago: '20', total: 0 }
    ]);
  };

  const handleUpdatePayment = (index: number, updates: Partial<RetentionPayment>) => {
    setPagos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemovePayment = (index: number) => {
    if (pagos.length <= 1) return;
    setPagos((prev) => prev.filter((_, i) => i !== index));
  };

  // Formato de fecha para SRI: DD/MM/YYYY
  function formatToDdMmYyyy(isoDate: string): string {
    if (!isoDate) return '01/01/2026';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoDate)) return isoDate;
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    const d = new Date(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  // Documento de sustento estructurado
  const dummyDoc: DocSustento = {
    id: 'sustento-1',
    codSustento,
    codDocSustento,
    numDocSustento: (numDocSustento || '001001000000001').replace(/\D/g, '').padStart(15, '0').slice(-15),
    fechaEmisionDocSustento: formatToDdMmYyyy(fechaEmisionDocSustento),
    fechaRegistroContable: fechaRegistroContable ? formatToDdMmYyyy(fechaRegistroContable) : undefined,
    numAutDocSustento: numAutDocSustento.trim() || undefined,
    pagoLocExt,
    tipoRegi: pagoLocExt === '02' ? tipoRegi : undefined,
    paisEfecPago: pagoLocExt === '02' ? paisEfecPago : undefined,
    aplicConvDobTrib: pagoLocExt === '02' ? aplicConvDobTrib : undefined,
    pagExtSujRetNorLeg: pagoLocExt === '02' ? pagExtSujRetNorLeg : undefined,
    totalSinImpuestos,
    importeTotal,
    impuestosDocSustento,
    retenciones,
    pagos,
  };

  const totals = RetentionCalculationEngine.calculateTotals([dummyDoc]);

  // Construcción del borrador normalizado (RetentionDraft)
  const buildRetentionDraft = (claveAcceso: string, secuencial: string): RetentionDraft => {
    return {
      issuer: {
        ruc: (settings.taxId || '0999999999001').trim(),
        razonSocial: settings.legalName || settings.storeName || 'FERRETERIA DAYNET',
        nombreComercial: settings.storeName,
        dirMatriz: settings.address || 'Guayaquil, Ecuador',
        estab: establishment.padStart(3, '0'),
        ptoEmi: emissionPoint.padStart(3, '0'),
        obligadoContabilidad: settings.accountingRequired ? 'SI' : 'NO',
        contribuyenteEspecial: settings.specialTaxpayerNumber || undefined,
        agenteRetencion: settings.isRetentionAgent ? (settings.retentionAgentResolution || '1') : undefined,
        contribuyenteRimpe: settings.isRimpe ? 'CONTRIBUYENTE RÉGIMEN RIMPE' : undefined,
      },
      retentionInfo: {
        fechaEmision: formatToDdMmYyyy(fechaEmisionRetencion),
        periodoFiscal: periodoFiscal.trim(),
        parteRel,
        ambiente,
        tipoEmision: '1',
        secuencial: secuencial.padStart(9, '0'),
        claveAcceso,
      },
      retainedSubject: {
        tipoIdentificacion: tipoId,
        identificacion: identificacion.trim(),
        razonSocial: razonSocial.trim(),
        direccion: direccion.trim() || undefined,
        email: email.trim() || undefined,
      },
      supportDocuments: [
        {
          id: 'sustento-1',
          codSustento,
          codDocSustento,
          numDocSustento: (numDocSustento || '').replace(/\D/g, '').padStart(15, '0').slice(-15),
          fechaEmisionDocSustento: formatToDdMmYyyy(fechaEmisionDocSustento),
          fechaRegistroContable: fechaRegistroContable ? formatToDdMmYyyy(fechaRegistroContable) : undefined,
          numAutDocSustento: numAutDocSustento.trim() || undefined,
          pagoLocExt,
          foreignPayment: pagoLocExt === '02' ? {
            tipoRegi,
            paisEfecPago,
            aplicConvDobTrib,
            pagExtSujRetNorLeg,
          } : undefined,
          totalSinImpuestos,
          importeTotal,
          taxes: impuestosDocSustento,
          withholdings: retenciones,
          payments: pagos,
        }
      ],
      sriReservation: {
        secuencial: secuencial.padStart(9, '0'),
        claveAcceso,
        ambiente,
      }
    };
  };

  // Generar Previsualización del XML sin firma
  const handleOpenPreview = () => {
    setErrorMsg(null);
    if (!identificacion.trim() || !razonSocial.trim()) {
      setErrorMsg('Debe completar la identificación y razón social del proveedor para previsualizar.');
      return;
    }

    const tempSec = reservedSecuencial || secRetention;
    const { claveAcceso } = SriRetentionXmlGenerator.generateClaveAcceso({
      fechaEmision: formatToDdMmYyyy(fechaEmisionRetencion),
      ruc: settings.taxId || '0999999999001',
      ambiente,
      estab: establishment,
      ptoEmi: emissionPoint,
      secuencial: tempSec,
    });

    const draft = buildRetentionDraft(claveAcceso, tempSec);
    const sriData = RetentionDraftMapper.toSriData(draft);
    const generated = SriRetentionXmlGenerator.generateXml(sriData);

    setPreviewXml(generated.xml);
    setShowPreviewModal(true);
  };

  // Validaciones previas en UI
  const isProveedorValid = identificacion.trim().length >= 10 && razonSocial.trim().length > 0;
  const isDocSustentoValid = numDocSustento.replace(/\D/g, '').length === 15;
  const isRetencionesValid = retenciones.length > 0;
  const isPeriodoValid = /^\d{2}\/\d{4}$/.test(periodoFiscal.trim());
  const isFormValid = isProveedorValid && isDocSustentoValid && isRetencionesValid && isPeriodoValid;

  // Ejecución de emisión al backend Java
  const handleEmitirSri = async () => {
    setErrorMsg(null);

    if (!isFormValid) {
      setErrorMsg('Por favor complete todos los campos obligatorios antes de continuar.');
      return;
    }
    if (identificacion.trim() === '9999999999999') {
      setErrorMsg('No se permite emitir comprobantes de retención a Consumidor Final (código 07).');
      return;
    }

    setIsEmitting(true);
    setCurrentStep('Solicitando reserva de secuencial y clave de acceso a Java...');

    try {
      // 1. Solicitar reserva de secuencial a Java
      const reservation = await RetentionApiClient.reserveRetention({
        estab: establishment,
        ptoEmi: emissionPoint,
        ruc: settings.taxId || '0999999999001',
        ambiente,
        fechaEmision: formatToDdMmYyyy(fechaEmisionRetencion),
        currentSecuencialHint: reservedSecuencial || secRetention,
      });

      const definitiveSec = reservation.secuencial;
      const definitiveClave = reservation.claveAcceso;
      setReservedSecuencial(definitiveSec);
      setReservedClaveAcceso(definitiveClave);

      // 2. Construir modelo normalizado y generar XML ATS 2.0.0 SIN FIRMA
      setCurrentStep('Construyendo XML ATS 2.0.0 sin firma...');
      const draft = buildRetentionDraft(definitiveClave, definitiveSec);
      const sriData = RetentionDraftMapper.toSriData(draft);

      // Validación XSD previa
      const validation = RetentionXsdValidator.validate(sriData);
      if (!validation.isValid) {
        setErrorMsg(`Error de validación XSD previo: ${validation.errors.join(' | ')}`);
        setIsEmitting(false);
        return;
      }

      const generated = SriRetentionXmlGenerator.generateXml(sriData);

      // 3. Entregar XML sin firma a Java (Fin de responsabilidad frontend)
      setCurrentStep('Entregando XML sin firma al backend Java...');
      const submitRes = await RetentionApiClient.submitUnsignedRetentionXml({
        unsignedXml: generated.xml,
        expectedAccessKey: definitiveClave,
        secuencial: definitiveSec,
        estab: establishment,
        ptoEmi: emissionPoint,
        reservationId: reservation.reservationId,
        onProgress: (step, detail) => {
          setCurrentStep(detail || step);
        },
      });

      if (submitRes.success || submitRes.status === 'AUTORIZADO') {
        const record: RetentionRecord = {
          id: `${establishment}-${emissionPoint}-${definitiveSec}`,
          secuencial: definitiveSec,
          estab: establishment,
          ptoEmi: emissionPoint,
          claveAcceso: definitiveClave,
          fechaEmision: formatToDdMmYyyy(fechaEmisionRetencion),
          periodoFiscal,
          ambiente,
          estado: 'AUTORIZADO',
          sujetoRetenido: {
            tipoIdentificacion: tipoId,
            identificacion,
            razonSocial,
            direccion,
            email,
          },
          docsSustento: sriData.docsSustento,
          totalRetenidoRenta: totals.totalRetenidoRenta,
          totalRetenidoIva: totals.totalRetenidoIva,
          totalRetenidoIsd: totals.totalRetenidoIsd,
          totalRetenido: totals.totalRetenido,
          numeroAutorizacion: submitRes.numeroAutorizacion || definitiveClave,
          fechaAutorizacion: submitRes.fechaAutorizacion || getEcuadorianDateTime().isoLocal,
          xmlGenerado: generated.xml,
          xmlAutorizado: submitRes.rawResponse,
          createdAt: getEcuadorianDateTime().isoLocal,
          updatedAt: getEcuadorianDateTime().isoLocal,
        };

        onSuccess(record);
      } else {
        setErrorMsg(submitRes.mensaje || 'El backend Java devolvió un estado no autorizado.');
      }
    } catch (err: any) {
      setErrorMsg(`Error inesperado en comunicación con Java: ${err.message || err}`);
    } finally {
      setIsEmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 animate-fadeIn my-auto flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header Fijo Institucional */}
        <div className="flex-shrink-0 bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/30 rounded-xl flex items-center justify-center text-orange-400">
              <Percent className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">Comprobante de Retención Electrónico</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  ATS v2.0.0
                </span>
              </div>
              <p className="text-slate-400 text-xs font-medium">Esquema Off-line codDoc 07 • SRI Ecuador</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">N° Secuencial SRI</span>
              <span className="font-mono text-xs font-black text-orange-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                {establishment}-{emissionPoint}-{reservedSecuencial || secRetention}
              </span>
            </div>
            <button
              onClick={onClose}
              disabled={isEmitting}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error de Validación / Emisión:</p>
                <p className="font-medium mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* 0. DATOS GENERALES DEL COMPROBANTE DE RETENCIÓN */}
          <div className="bg-slate-900 text-white rounded-2xl p-4.5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Datos de Emisión de la Retención (codDoc 07)
              </h3>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Ambiente: <strong className="text-white">{ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Fecha Emisión Retención *</label>
                <input
                  type="date"
                  value={fechaEmisionRetencion}
                  onChange={(e) => setFechaEmisionRetencion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Período Fiscal (MM/AAAA) *</label>
                <input
                  type="text"
                  placeholder="09/2026"
                  maxLength={7}
                  value={periodoFiscal}
                  onChange={(e) => setPeriodoFiscal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Parte Relacionada *</label>
                <Select
                  value={parteRel}
                  onChange={(e) => setParteRel(e.target.value as 'SI' | 'NO')}
                  className="w-full text-xs font-bold bg-slate-800 text-white border-slate-700"
                >
                  <option value="NO">NO - No es parte relacionada</option>
                  <option value="SI">SI - Es parte relacionada</option>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Secuencial Controlado por Java</label>
                <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-black text-orange-400 flex items-center justify-between">
                  <span>{establishment}-{emissionPoint}</span>
                  <span>{reservedSecuencial || secRetention}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. IMPORTAR FACTURA XML O VINCULAR CON COMPRA */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-3">
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".xml,text/xml" 
              onChange={handleFileChange} 
              className="hidden" 
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" /> Factura de Compra de Sustento
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Importe el XML del proveedor para autocompletar el 100% de datos y sugerencias
              </span>
            </div>

            {/* Tarjeta de Factura Importada o Zona de Carga */}
            {importedInvoice ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-950">Factura Electrónica Importada Exitosamente</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                        XML SRI
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                      {importedInvoice.razonSocial} • Factura: <span className="font-mono text-emerald-700 font-black">{importedInvoice.numDoc}</span>
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2 text-[11px] font-medium text-slate-600">
                      <span className="bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        Subtotal: <strong className="text-slate-900 font-mono">${importedInvoice.subtotal.toFixed(2)}</strong>
                      </span>
                      <span className="bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        IVA: <strong className="text-slate-900 font-mono">${importedInvoice.iva.toFixed(2)}</strong>
                      </span>
                      <span className="bg-emerald-100/70 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-emerald-900 font-mono">
                        Total Factura: <strong>${importedInvoice.total.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Cambiar XML</span>
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col sm:flex-row items-center justify-between gap-3.5 ${
                  isDragging 
                    ? 'border-orange-500 bg-orange-500/10 ring-4 ring-orange-500/15' 
                    : 'border-orange-300/80 bg-gradient-to-r from-orange-50/50 via-white to-amber-50/40 hover:border-orange-400'
                }`}
              >
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-600 flex-shrink-0 mx-auto sm:mx-0">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">
                      Importar Factura Electrónica del Proveedor (.xml)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Suelte aquí el XML recibido de su proveedor o cárguelo para autocompletar todo automáticamente
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>Subir Factura XML</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClaveInput(!showClaveInput)}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showClaveInput ? 'Ocultar' : 'Por Clave de Acceso'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Input desplegable para consultar Clave de Acceso al Backend Java */}
            {showClaveInput && (
              <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-2 animate-fadeIn">
                <div className="relative flex-1 w-full">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={49}
                    placeholder="Pegue aquí la Clave de Acceso de 49 dígitos (se consulta a través de Java)..."
                    value={claveAccesoInput}
                    onChange={(e) => setClaveAccesoInput(e.target.value)}
                    style={{ color: '#000000' }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-black placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none focus:bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQuerySriClave}
                  disabled={isQueryingSri || claveAccesoInput.trim().replace(/\D/g, '').length !== 49}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isQueryingSri ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                      <span>Consultando en Java...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5 text-orange-400" />
                      <span>Consultar y Completar</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Selección alternativa de compra en BD y Régimen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  O vincular con Factura de Compra registrada en el sistema:
                </label>
                <Select
                  value={selectedPurchaseId}
                  onChange={(e) => setSelectedPurchaseId(e.target.value)}
                  className="w-full text-xs font-bold bg-white"
                >
                  <option value="">Ingreso Manual / Factura Externa...</option>
                  {purchases.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.invoiceNumber || p.id} • {p.supplier?.name || 'Proveedor'} • ${Number(p.total || 0).toFixed(2)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Régimen Tributario Proveedor:
                </label>
                <Select
                  value={supplierCondition}
                  onChange={(e: any) => {
                    setSupplierCondition(e.target.value);
                    if (totalSinImpuestos > 0 || montoIva > 0) {
                      autoSuggestRetentions(totalSinImpuestos, montoIva, { regimen: e.target.value }, undefined, e.target.value);
                    }
                  }}
                  className="w-full text-xs font-bold bg-white"
                >
                  <option value="GENERAL">Régimen General / Soc.</option>
                  <option value="RIMPE_EMPRENDEDOR">RIMPE Emprendedor (1%)</option>
                  <option value="RIMPE_POPULAR">RIMPE Negocio Popular</option>
                  <option value="ESPECIAL">Contribuyente Especial</option>
                </Select>
              </div>
            </div>
          </div>

          {/* 2. DATOS DEL SUJETO RETENIDO (PROVEEDOR) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" /> Información del Sujeto Retenido (Proveedor)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Tipo de Identificación *</label>
                <Select
                  value={tipoId}
                  onChange={(e) => setTipoId(e.target.value as TipoIdentificacionSujetoRetenido)}
                  className="w-full text-xs font-bold"
                >
                  <option value="04">04 - RUC (13 dígitos)</option>
                  <option value="05">05 - Cédula (10 dígitos)</option>
                  <option value="06">06 - Pasaporte</option>
                  <option value="08">08 - Identificación Exterior</option>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Identificación / RUC *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1790011223001"
                  value={identificacion}
                  onChange={(e) => setIdentificacion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Razón Social / Proveedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Nombre legal completo"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Correo Electrónico (Notificación)</label>
                <input
                  type="email"
                  placeholder="proveedor@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Dirección del Proveedor</label>
                <input
                  type="text"
                  placeholder="Av. Principal y Secundaria"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. DOCUMENTO DE SUSTENTO (FACTURA RETENIDA) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" /> Documento Sustento Tributario (ATS v2.0.0)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Sustento Tributario (Tabla 4 ATS) *</label>
                <Select
                  value={codSustento}
                  onChange={(e) => setCodSustento(e.target.value)}
                  className="w-full text-xs font-bold"
                >
                  {SUSTENTOS_TRIBUTARIOS_ATS.map((s) => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Tipo Comprobante (Tabla 3 ATS) *</label>
                <Select
                  value={codDocSustento}
                  onChange={(e) => setCodDocSustento(e.target.value)}
                  className="w-full text-xs font-bold"
                >
                  {TIPOS_DOC_SUSTENTO_ATS.map((d) => (
                    <option key={d.code} value={d.code}>{d.label}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">N° Comprobante Sustento (15 dígitos) *</label>
                <input
                  type="text"
                  placeholder="001-001-000012345"
                  value={numDocSustento}
                  onChange={(e) => setNumDocSustento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  N° Autorización / Clave de Acceso SRI de la Factura (49 dígitos)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 0101202601099999999900110010010000123451234567813"
                  value={numAutDocSustento}
                  onChange={(e) => setNumAutDocSustento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Fecha Emisión Factura *</label>
                <input
                  type="date"
                  value={fechaEmisionDocSustento}
                  onChange={(e) => setFechaEmisionDocSustento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Fecha Registro Contable (Opcional)</label>
                <input
                  type="date"
                  value={fechaRegistroContable}
                  onChange={(e) => setFechaRegistroContable(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Pago Local / Exterior *</label>
                <Select
                  value={pagoLocExt}
                  onChange={(e) => setPagoLocExt(e.target.value as '01' | '02')}
                  className="w-full text-xs font-bold"
                >
                  <option value="01">01 - Pago a Residente Local</option>
                  <option value="02">02 - Pago al Exterior</option>
                </Select>
              </div>
            </div>

            {/* Campos condicionales de Pago al Exterior (Progressive Disclosure) */}
            {pagoLocExt === '02' && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-fadeIn">
                <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-600" /> Información Específica de Pago al Exterior (ATS)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 block mb-1">Tipo Régimen Fiscal *</label>
                    <Select
                      value={tipoRegi}
                      onChange={(e) => setTipoRegi(e.target.value)}
                      className="w-full text-xs font-medium bg-white"
                    >
                      <option value="01">01 - Régimen General</option>
                      <option value="02">02 - Paraíso Fiscal</option>
                      <option value="03">03 - Régimen Fiscal Preferente</option>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-800 block mb-1">País Pago Exterior (SRI) *</label>
                    <input
                      type="text"
                      maxLength={3}
                      placeholder="Ej: 593"
                      value={paisEfecPago}
                      onChange={(e) => setPaisEfecPago(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-800 block mb-1">Convenio Doble Trib. *</label>
                    <Select
                      value={aplicConvDobTrib}
                      onChange={(e) => setAplicConvDobTrib(e.target.value as 'SI' | 'NO')}
                      className="w-full text-xs font-medium bg-white"
                    >
                      <option value="NO">NO aplica convenio</option>
                      <option value="SI">SI aplica convenio</option>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-800 block mb-1">Ret. Norma Legal *</label>
                    <Select
                      value={pagExtSujRetNorLeg}
                      onChange={(e) => setPagExtSujRetNorLeg(e.target.value as 'SI' | 'NO')}
                      className="w-full text-xs font-medium bg-white"
                    >
                      <option value="NO">NO retención norma</option>
                      <option value="SI">SI retención norma</option>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* 3.1 TABLA DE MÚLTIPLES IMPUESTOS DE SUSTENTO */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-orange-500" /> Desglose de Impuestos del Comprobante Sustento
                </label>
                <button
                  type="button"
                  onClick={handleAddTaxLine}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Agregar Tarifa
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black">
                    <tr>
                      <th className="py-2 px-3">Impuesto</th>
                      <th className="py-2 px-3">Tarifa %</th>
                      <th className="py-2 px-3 text-right">Base Imponible</th>
                      <th className="py-2 px-3 text-right">Valor Impuesto</th>
                      <th className="py-2 px-3 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {impuestosDocSustento.map((tax, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3">
                          <Select
                            value={tax.codImpuestoDocSustento}
                            onChange={(e) => handleUpdateTaxLine(idx, { codImpuestoDocSustento: e.target.value })}
                            className="text-xs font-bold py-1"
                          >
                            <option value="2">2 - IVA</option>
                            <option value="3">3 - ICE</option>
                            <option value="5">5 - IRBPNR</option>
                          </Select>
                        </td>
                        <td className="py-2 px-3">
                          <Select
                            value={tax.codigoPorcentaje}
                            onChange={(e) => handleUpdateTaxLine(idx, { codigoPorcentaje: e.target.value })}
                            className="text-xs font-bold py-1"
                          >
                            <option value="4">15% (Vigente)</option>
                            <option value="5">5% (Materiales Construcción)</option>
                            <option value="2">12% (Tarifa General Anterior)</option>
                            <option value="0">0% (Tarifa Cero)</option>
                          </Select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="relative inline-block w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tax.baseImponible}
                              onChange={(e) => handleUpdateTaxLine(idx, { baseImponible: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-5 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-xs"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-xs text-slate-900">
                          ${tax.valorImpuesto.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {impuestosDocSustento.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTaxLine(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3.2 FORMAS DE PAGO DEL SUSTENTO */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Formas de Pago del Comprobante
                </label>
                <button
                  type="button"
                  onClick={handleAddPayment}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Agregar Pago
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black">
                    <tr>
                      <th className="py-2 px-3">Código Forma de Pago</th>
                      <th className="py-2 px-3 text-right">Total Asignado</th>
                      <th className="py-2 px-3 text-center w-24">Plazo</th>
                      <th className="py-2 px-3 w-28">Unidad</th>
                      <th className="py-2 px-3 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pagos.map((pago, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3">
                          <Select
                            value={pago.formaPago}
                            onChange={(e) => handleUpdatePayment(idx, { formaPago: e.target.value })}
                            className="text-xs font-bold py-1"
                          >
                            <option value="20">20 - Otros con utilización del sistema financiero</option>
                            <option value="01">01 - Sin utilización del sistema financiero (Efectivo)</option>
                            <option value="16">16 - Tarjeta de Débito</option>
                            <option value="19">19 - Tarjeta de Crédito</option>
                            <option value="17">17 - Dinero Electrónico</option>
                          </Select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="relative inline-block w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pago.total}
                              onChange={(e) => handleUpdatePayment(idx, { total: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-5 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-xs"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={pago.plazo ?? ''}
                            onChange={(e) => handleUpdatePayment(idx, { plazo: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-xs"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Select
                            value={pago.unidadTiempo || 'dias'}
                            onChange={(e) => handleUpdatePayment(idx, { unidadTiempo: e.target.value })}
                            className="text-xs font-medium py-1"
                          >
                            <option value="dias">Días</option>
                            <option value="meses">Meses</option>
                          </Select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {pagos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePayment(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. LÍNEAS DE RETENCIÓN (RENTA, IVA, ISD) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-slate-500" /> Detalle de Retenciones Aplicadas
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Catálogo versionado conforme a la Res. NAC-DGERCGC26-00000009 y Ficha Técnica SRI
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => autoSuggestRetentions(totalSinImpuestos, montoIva)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sugerir Normativa</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddLine('RENTA')}
                  className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-orange-500/20"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Ret. Renta</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddLine('IVA')}
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Ret. IVA</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddLine('ISD')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Agregar retención de Impuesto a la Salida de Divisas"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ret. ISD</span>
                </button>
              </div>
            </div>

            {retenciones.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No hay líneas de retención agregadas.</p>
                <p className="text-[11px] text-slate-400">
                  Haga clic en "Ret. Renta", "Ret. IVA" o "Sugerir Normativa" para calcular automáticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs min-w-[720px]">
                  <thead className="bg-slate-950 text-white uppercase text-[10px] font-black tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5 whitespace-nowrap w-24">Impuesto</th>
                      <th className="py-3 px-3.5">Concepto / Código SRI</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap w-36">Base Imponible</th>
                      <th className="py-3 px-3.5 text-center whitespace-nowrap w-28">% Retener</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap w-32">Valor Retenido</th>
                      <th className="py-3 px-3.5 text-center w-14">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium bg-white">
                    {retenciones.map((line) => {
                      const isRenta = line.codigo === '1';
                      const isIva = line.codigo === '2';
                      const isIsd = line.codigo === '6';
                      const activeOptions = isRenta ? activeIrCodes : isIva ? activeIvaCodes : activeIsdCodes;

                      return (
                        <tr key={line.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-md font-black text-[11px] tracking-wide inline-block ${
                                isRenta
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : isIva
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {isRenta ? 'RENTA' : isIva ? 'IVA' : 'ISD'}
                            </span>
                          </td>

                          <td className="py-3 px-3.5 min-w-[320px]">
                            <Select
                              value={line.codigoRetencion}
                              onChange={(e) => handleUpdateLine(line.id, { codigoRetencion: e.target.value })}
                              className="w-full text-xs font-semibold py-1.5"
                            >
                              {activeOptions.map((opt) => {
                                const cleanDesc = opt.description.replace(/\s*\(\d+(\.\d+)?%\)\s*$/, '');
                                return (
                                  <option key={opt.id} value={opt.sriCode}>
                                    {opt.sriCode} - {cleanDesc} ({opt.percentage}%)
                                  </option>
                                );
                              })}
                            </Select>
                          </td>

                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="relative inline-block w-32">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.baseImponible}
                                onChange={(e) =>
                                  handleUpdateLine(line.id, { baseImponible: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-right font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none shadow-2xs"
                              />
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-xs text-slate-800">
                              {line.porcentajeRetener.toFixed(2)}%
                            </span>
                          </td>

                          <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono font-black text-sm text-slate-900">
                            ${line.valorRetenido.toFixed(2)}
                          </td>

                          <td className="py-3 px-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.id)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar retención"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5. PANEL DE VALIDACIONES PREVIAS */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Panel de Validaciones de Integridad Pre-Envío
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-bold">
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isProveedorValid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {isProveedorValid ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                <span>Sujeto Retenido</span>
              </div>
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isDocSustentoValid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {isDocSustentoValid ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                <span>Sustento (15 d.)</span>
              </div>
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isRetencionesValid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {isRetencionesValid ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                <span>Retenciones</span>
              </div>
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isPeriodoValid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {isPeriodoValid ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                <span>Período Fiscal</span>
              </div>
            </div>
          </div>

          {/* 6. RESUMEN DE TOTALES Y REGLAS SRI */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Resumen de Retención SRI (ATS v2.0.0)
              </span>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span>Renta: <b className="font-mono text-amber-400">${totals.totalRetenidoRenta.toFixed(2)}</b></span>
                <span>•</span>
                <span>IVA: <b className="font-mono text-indigo-400">${totals.totalRetenidoIva.toFixed(2)}</b></span>
                {totals.totalRetenidoIsd > 0 && (
                  <>
                    <span>•</span>
                    <span>ISD: <b className="font-mono text-emerald-400">${totals.totalRetenidoIsd.toFixed(2)}</b></span>
                  </>
                )}
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">TOTAL A RETENER</span>
              <span className="text-2xl font-black font-mono text-orange-400">
                ${totals.totalRetenido.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="flex-shrink-0 bg-slate-50 p-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {isEmitting ? (
              <span className="flex items-center gap-2 text-orange-600 font-bold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" /> {currentStep}
              </span>
            ) : (
              <span>Ambiente SRI: <b>{ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}</b> • Frontend genera XML sin firma y entrega a Java</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleOpenPreview}
              disabled={isEmitting || !isFormValid}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Previsualizar XML</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isEmitting}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleEmitirSri}
              disabled={isEmitting || !isFormValid}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-orange-500/25"
            >
              {isEmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando en Java...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Emitir y Autorizar SRI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN: RESUMEN Y XML SIN FIRMAR */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[1000000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-fadeIn">
            <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm sm:text-base font-black text-white">Revisar Comprobante de Retención (codDoc 07)</h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas RESUMEN / XML SIN FIRMA */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6">
              <button
                type="button"
                onClick={() => setPreviewTab('RESUMEN')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  previewTab === 'RESUMEN'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                RESUMEN DE OPERACIÓN
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('XML')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  previewTab === 'XML'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>XML ATS 2.0.0 (SIN FIRMA)</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 text-slate-700">Sin firma</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {previewTab === 'RESUMEN' ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sujeto Retenido (Proveedor)</span>
                      <p className="font-bold text-slate-900 text-sm">{razonSocial}</p>
                      <p className="font-mono text-slate-700">RUC: {identificacion}</p>
                      <p className="text-slate-600">Dirección: {direccion || 'MATRIZ'}</p>
                      {email && <p className="text-slate-600">Email: {email}</p>}
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Documento de Sustento</span>
                      <p className="font-bold text-slate-900 text-sm">Factura N° {numDocSustento}</p>
                      <p className="text-slate-700">Fecha Factura: {fechaEmisionDocSustento}</p>
                      <p className="font-mono text-[11px] text-slate-600">Subtotal: ${totalSinImpuestos.toFixed(2)} • IVA: ${montoIva.toFixed(2)}</p>
                      <p className="font-bold text-slate-900">Total Comprobante: ${importeTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retenciones a Aplicar</span>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-black">
                        <tr>
                          <th className="p-2">Impuesto</th>
                          <th className="p-2">Código SRI</th>
                          <th className="p-2 text-right">Base</th>
                          <th className="p-2 text-center">% Ret.</th>
                          <th className="p-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {retenciones.map((r) => (
                          <tr key={r.id}>
                            <td className="p-2 font-bold">{r.codigo === '1' ? 'RENTA' : r.codigo === '2' ? 'IVA' : 'ISD'}</td>
                            <td className="p-2 font-mono">{r.codigoRetencion}</td>
                            <td className="p-2 text-right font-mono">${r.baseImponible.toFixed(2)}</td>
                            <td className="p-2 text-center font-mono">{r.porcentajeRetener.toFixed(2)}%</td>
                            <td className="p-2 text-right font-mono font-bold">${r.valorRetenido.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Total a Retener</span>
                      <span className="text-xs text-slate-300">Este valor se descontará del pago al proveedor</span>
                    </div>
                    <span className="text-xl font-mono font-black text-orange-400">
                      ${totals.totalRetenido.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500">
                      Estructura oficial XSD ATS v2.0.0 (Sin etiquetas de firma digital)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(previewXml);
                        setIsCopiedXml(true);
                        setTimeout(() => setIsCopiedXml(false), 2000);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isCopiedXml ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopiedXml ? 'Copiado!' : 'Copiar XML'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-[11px] p-4 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto select-all max-h-[50vh] border border-slate-800">
                    <code>{previewXml}</code>
                  </pre>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Cerrar Previsualización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

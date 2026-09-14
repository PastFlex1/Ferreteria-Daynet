/**
 * @fileOverview Suite de Pruebas Unitarias Automatizadas para el Frontend de Retenciones SRI ATS 2.0.0.
 * Cubre todos los casos exigidos en la Sección 25:
 * - Parser XML seguro y prevención de ataques XXE.
 * - Extracción de múltiples impuestos y pagos.
 * - Cálculos decimales exactos.
 * - Mapeo de dominio y serialización de XML ATS 2.0.0 sin firma.
 * - Ausencia total de ds:Signature y ausencia de datos secretos.
 * - Validaciones pre-vuelo XSD.
 */

import { SriInvoiceXmlParser } from '../src/services/retention/sriInvoiceXmlParser';
import { RetentionCalculationEngine } from '../src/services/retention/RetentionCalculationEngine';
import { RetentionCatalogService } from '../src/services/retention/RetentionCatalogService';
import { RetentionDraftMapper } from '../src/services/retention/retentionDraftMapper';
import { SriRetentionXmlGenerator } from '../src/services/retention/SriRetentionXmlGenerator';
import { RetentionXsdValidator } from '../src/services/retention/RetentionXsdValidator';
import { RetentionDraft, SRIRetentionData } from '../src/types/retention';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

console.log('\n=== INICIANDO SUITE DE PRUEBAS FRONTEND SRI RETENCIONES ATS 2.0.0 ===\n');

// 1. Parser XML: Factura válida con múltiples impuestos y pagos
const sampleValidInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>1</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>ACEROS DEL PACIFICO S.A.</razonSocial>
    <nombreComercial>ACEROPAC</nombreComercial>
    <ruc>0992345678001</ruc>
    <claveAcceso>1309202601099234567800110010010000888881234567818</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>002</ptoEmi>
    <secuencial>000088888</secuencial>
    <dirMatriz>Av. Juan Tanca Marengo Km 4.5</dirMatriz>
    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>12/09/2026</fechaEmision>
    <dirEstablecimiento>Parque Industrial Sauce</dirEstablecimiento>
    <totalSinImpuestos>1500.00</totalSinImpuestos>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>1000.00</baseImponible>
        <tarifa>15.00</tarifa>
        <valor>150.00</valor>
      </totalImpuesto>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>5</codigoPorcentaje>
        <baseImponible>500.00</baseImponible>
        <tarifa>5.00</tarifa>
        <valor>25.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <importeTotal>1675.00</importeTotal>
    <pagos>
      <pago>
        <formaPago>20</formaPago>
        <total>1000.00</total>
        <plazo>30</plazo>
        <unidadTiempo>dias</unidadTiempo>
      </pago>
      <pago>
        <formaPago>01</formaPago>
        <total>675.00</total>
      </pago>
    </pagos>
  </infoFactura>
  <infoAdicional>
    <campoAdicional nombre="Email">facturacion@aceropac.com</campoAdicional>
    <campoAdicional nombre="Telefono">042999999</campoAdicional>
  </infoAdicional>
</factura>`;

const parsed = SriInvoiceXmlParser.parseXml(sampleValidInvoiceXml);
if (!parsed.success) {
  console.error('PARSED ERROR:', parsed.error);
}
assert(parsed.success === true, '1. Cargar XML de factura válido', parsed.error);
assert(parsed.supplier.ruc === '0992345678001', '2. RUC Proveedor autocompletado');
assert(parsed.supplier.razonSocial === 'ACEROS DEL PACIFICO S.A.', '3. Razón social proveedor autocompletada');
assert(parsed.supplier.condition === 'RIMPE_EMPRENDEDOR', '4. Detección automática de régimen RIMPE');
assert(parsed.invoice.formattedNumber === '001-002-000088888', '5. Serie de factura formateada');
assert(parsed.invoice.claveAcceso === '1309202601099234567800110010010000888881234567818', '6. Clave de acceso extraída');
assert(parsed.invoice.impuestos.length === 2, '7. Múltiples impuestos extraídos (IVA 15% y IVA 5%)');
assert(parsed.invoice.montoIva === 175.00, '8. Monto total IVA acumulado correctamente');
assert(parsed.invoice.pagos.length === 2, '9. Múltiples formas de pago extraídas');

// 2. Seguridad: Rechazo de ataques XXE
const xxeAttackXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [ <!ELEMENT foo ANY >
<!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
<factura id="comprobante"><infoTributaria><ruc>&xxe;</ruc></infoTributaria></factura>`;

const xxeResult = SriInvoiceXmlParser.parseXml(xxeAttackXml);
assert(xxeResult.success === false && xxeResult.error?.includes('DOCTYPE'), '10. Rechazo estricto de XML con ataque XXE / DOCTYPE');

const scriptAttackXml = `<factura><infoTributaria><razonSocial><script>alert("hack")</script></razonSocial></infoTributaria></factura>`;
const scriptResult = SriInvoiceXmlParser.parseXml(scriptAttackXml);
assert(scriptResult.success === false && scriptResult.error?.includes('scripts'), '11. Rechazo de XML con inyección de scripts');

// 3. Cálculos decimales seguros sin aproximación float binaria
const base1 = 1234.56;
const pct1 = 1.75;
const val1 = RetentionCalculationEngine.calculateLineRetention(base1, pct1);
assert(val1 === 21.60, `12. Cálculo decimal exacto (1234.56 * 1.75% = 21.60): obtenido ${val1}`);

const base2 = 175.00;
const pct2 = 70.00;
const val2 = RetentionCalculationEngine.calculateLineRetention(base2, pct2);
assert(val2 === 122.50, `13. Cálculo IVA 70% exacto: obtenido ${val2}`);

const { claveAcceso: mockValidClave } = SriRetentionXmlGenerator.generateClaveAcceso({
  fechaEmision: '13/09/2026',
  ruc: '0999999999001',
  ambiente: '1',
  estab: '001',
  ptoEmi: '001',
  secuencial: '000000105',
  codigoNumerico: '12345678',
});

// 4. Mapeo de Dominio RetentionDraft -> SRIRetentionData
const mockDraft: RetentionDraft = {
  issuer: {
    ruc: '0999999999001',
    razonSocial: 'FERRETERIA DAYNET CIA. LTDA.',
    nombreComercial: 'FERRETERIA DAYNET',
    dirMatriz: 'Guayaquil, Av. Principal 123',
    estab: '001',
    ptoEmi: '001',
    obligadoContabilidad: 'SI',
    agenteRetencion: '1',
  },
  retentionInfo: {
    fechaEmision: '13/09/2026',
    periodoFiscal: '09/2026',
    parteRel: 'NO',
    ambiente: '1',
    tipoEmision: '1',
    secuencial: '000000105',
    claveAcceso: mockValidClave,
  },
  retainedSubject: {
    tipoIdentificacion: '04',
    identificacion: '0992345678001',
    razonSocial: 'ACEROS DEL PACIFICO S.A.',
    direccion: 'Parque Industrial Sauce',
    email: 'facturacion@aceropac.com',
  },
  supportDocuments: [
    {
      id: 'doc-1',
      codSustento: '01',
      codDocSustento: '01',
      numDocSustento: '001002000088888',
      fechaEmisionDocSustento: '12/09/2026',
      fechaRegistroContable: '13/09/2026',
      numAutDocSustento: '1309202601099234567800110010010000888881234567818',
      pagoLocExt: '01',
      totalSinImpuestos: 1500.00,
      importeTotal: 1675.00,
      taxes: [
        {
          codImpuestoDocSustento: '2',
          codigoPorcentaje: '4',
          baseImponible: 1000.00,
          tarifa: 15.00,
          valorImpuesto: 150.00,
        },
        {
          codImpuestoDocSustento: '2',
          codigoPorcentaje: '5',
          baseImponible: 500.00,
          tarifa: 5.00,
          valorImpuesto: 25.00,
        },
      ],
      withholdings: [
        {
          id: 'ret-1',
          codigo: '1', // RENTA
          codigoRetencion: '312',
          baseImponible: 1500.00,
          porcentajeRetener: 1.75,
          valorRetenido: 26.25,
        },
        {
          id: 'ret-2',
          codigo: '2', // IVA
          codigoRetencion: '1',
          baseImponible: 175.00,
          porcentajeRetener: 30.00,
          valorRetenido: 52.50,
        },
        {
          id: 'ret-3',
          codigo: '6', // ISD
          codigoRetencion: '4580',
          baseImponible: 500.00,
          porcentajeRetener: 5.00,
          valorRetenido: 25.00,
        },
      ],
      payments: [
        {
          formaPago: '20',
          total: 1675.00,
          plazo: 30,
          unidadTiempo: 'dias',
        },
      ],
    },
  ],
};

const sriData = RetentionDraftMapper.toSriData(mockDraft);
assert(sriData.rucEmisor === '0999999999001', '14. Mapeo RUC emisor correcto');
assert(sriData.docsSustento[0].retenciones.length === 3, '15. Mapeo de retenciones Renta, IVA e ISD simultáneas');
assert(sriData.docsSustento[0].impuestosDocSustento.length === 2, '16. Mapeo de múltiples impuestos de sustento');

// 5. Validación XSD Pre-Vuelo
const valRes = RetentionXsdValidator.validate(sriData);
assert(valRes.isValid === true, '17. Validación XSD pre-vuelo exitosa');

// Bloqueo de Consumidor Final (código 07)
const consumidorFinalDraft = { ...sriData, tipoIdentificacionSujetoRetenido: '07' as any };
const valConsumidorFinal = RetentionXsdValidator.validate(consumidorFinalDraft);
assert(valConsumidorFinal.isValid === false, '18. Bloqueo obligatorio de Consumidor Final (07) en retenciones');

// 6. Generación de XML ATS 2.0.0 sin firma
const { xml } = SriRetentionXmlGenerator.generateXml(sriData);

assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), '19. XML con declaración UTF-8 oficial');
assert(xml.includes('<comprobanteRetencion id="comprobante" version="2.0.0">'), '20. Raíz comprobanteRetencion versión 2.0.0');
assert(xml.includes('<codDoc>07</codDoc>'), '21. codDoc 07 (Comprobante de Retención)');
assert(xml.includes('<periodoFiscal>09/2026</periodoFiscal>'), '22. Período fiscal con formato MM/YYYY');
assert(xml.includes('<parteRel>NO</parteRel>'), '23. Campo obligatorio parteRel en infoCompRetencion');
assert(xml.includes('<totalSinImpuestos>1500.00</totalSinImpuestos>'), '24. Total sin impuestos exacto');
assert(xml.includes('<codigo>1</codigo>') && xml.includes('<codigoRetencion>312</codigoRetencion>'), '25. Retención de Renta código 312 en XML');
assert(xml.includes('<codigo>2</codigo>') && xml.includes('<codigoRetencion>1</codigoRetencion>'), '26. Retención de IVA código 1 en XML');
assert(xml.includes('<codigo>6</codigo>') && xml.includes('<codigoRetencion>4580</codigoRetencion>'), '27. Retención de ISD código 4580 en XML');

// REGLA DE ORO DE FRONTERA FRONTEND:
assert(!xml.includes('<ds:Signature'), '28. Ausencia total de <ds:Signature> (El frontend no firma)');
assert(!xml.includes('<Signature'), '29. Ausencia de firma XAdES');
assert(!xml.includes('password') && !xml.includes('certificadoBase64'), '30. Ausencia absoluta de certificados y secretos');

// 7. Prueba de Pago al Exterior (Progressive Disclosure)
const foreignDraft: RetentionDraft = {
  ...mockDraft,
  supportDocuments: [
    {
      ...mockDraft.supportDocuments[0],
      pagoLocExt: '02',
      foreignPayment: {
        tipoRegi: '01',
        paisEfecPago: '840', // USA
        aplicConvDobTrib: 'NO',
        pagExtSujRetNorLeg: 'NO',
      },
    },
  ],
};
const foreignSriData = RetentionDraftMapper.toSriData(foreignDraft);
const foreignXml = SriRetentionXmlGenerator.generateXml(foreignSriData).xml;
assert(foreignXml.includes('<pagoLocExt>02</pagoLocExt>'), '31. Soporte de pagoLocExt = 02');
assert(foreignXml.includes('<tipoRegi>01</tipoRegi>') && foreignXml.includes('<paisEfecPago>840</paisEfecPago>'), '32. Campos condicionales de pago al exterior presentes en XML');

console.log(`\n=== RESULTADO DE PRUEBAS: ${passedTests}/${totalTests} SUPERADAS (${((passedTests / totalTests) * 100).toFixed(1)}%) ===\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

/**
 * @fileOverview Generador Oficial de XML para Comprobantes de Retención Electrónicos del SRI (Ecuador).
 * Cumple estrictamente con el XSD oficial de Comprobante de Retención versión 2.0.0 (ATS)
 * y la Ficha Técnica de Comprobantes Electrónicos Esquema Off-line v2.34.
 *
 * Estructura raíz: <comprobanteRetencion id="comprobante" version="2.0.0">
 */

import { SRIRetentionData } from '../../types/retention';
import { modulo11 } from '../sriXmlService';
import { escapeXml } from '../sriAtsService';

export class SriRetentionXmlGenerator {
  /**
   * Genera la clave de acceso de 49 dígitos con el algoritmo Módulo 11 oficial del SRI.
   * [Fecha: 8] + [TipoDoc: 07] + [RUC: 13] + [Ambiente: 1|2] + [Estab: 3] + [PtoEmi: 3] +
   * [Secuencial: 9] + [CodNum: 8] + [TipoEmi: 1] + [DV: 1]
   */
  public static generateClaveAcceso(params: {
    fechaEmision: string; // DD/MM/YYYY
    ruc: string;
    ambiente: '1' | '2';
    estab: string;
    ptoEmi: string;
    secuencial: string;
    codigoNumerico?: string;
  }): { claveAcceso: string; codigoNumerico: string } {
    // 1. Fecha en formato DDMMAAAA
    const cleanFecha = (params.fechaEmision || '').replace(/\//g, '').trim();
    if (cleanFecha.length !== 8) {
      throw new Error(`Fecha de emisión inválida para clave de acceso: "${params.fechaEmision}". Se requiere formato DD/MM/YYYY.`);
    }

    // 2. Tipo de Comprobante = 07 (Retención)
    const tipoComprobante = '07';

    // 3. RUC Emisor (13 dígitos)
    const ruc = params.ruc.padStart(13, '0').slice(-13);

    // 4. Tipo de Ambiente (1 = Pruebas, 2 = Producción)
    const ambiente = params.ambiente;

    // 5. Serie (Estab 3 + PtoEmi 3)
    const serie = `${params.estab.padStart(3, '0')}${params.ptoEmi.padStart(3, '0')}`;

    // 6. Secuencial (9 dígitos)
    const secuencial = params.secuencial.padStart(9, '0');

    // 7. Código numérico (8 dígitos)
    let codigoNumerico = params.codigoNumerico;
    if (!codigoNumerico || !/^\d{8}$/.test(codigoNumerico)) {
      // Generar 8 dígitos pseudo-aleatorios con semilla segura
      codigoNumerico = String(Math.floor(10000000 + Math.random() * 90000000));
    }

    // 8. Tipo de Emisión = 1 (Normal)
    const tipoEmision = '1';

    // Construir los 48 dígitos iniciales
    const base48 = `${cleanFecha}${tipoComprobante}${ruc}${ambiente}${serie}${secuencial}${codigoNumerico}${tipoEmision}`;

    // 9. Calcular Dígito Verificador Módulo 11
    const dv = modulo11(base48);

    const claveAcceso = `${base48}${dv}`;

    return { claveAcceso, codigoNumerico };
  }

  /**
   * Genera el XML oficial versión 2.0.0 completo y formateado para el SRI.
   */
  public static generateXml(data: SRIRetentionData): { xml: string; claveAcceso: string } {
    // Asegurar clave de acceso
    let claveAcceso = data.claveAcceso;
    if (!claveAcceso || claveAcceso.length !== 49) {
      const generated = this.generateClaveAcceso({
        fechaEmision: data.fechaEmision,
        ruc: data.rucEmisor,
        ambiente: data.ambiente,
        estab: data.estab,
        ptoEmi: data.ptoEmi,
        secuencial: data.secuencial,
      });
      claveAcceso = generated.claveAcceso;
    }

    // Sanitizar y formatear campos de cabecera
    const rucEmisor = escapeXml(data.rucEmisor.trim());
    const razonSocial = escapeXml(data.razonSocialEmisor.trim());
    const nombreComercial = data.nombreComercialEmisor ? escapeXml(data.nombreComercialEmisor.trim()) : '';
    const dirMatriz = escapeXml(data.dirMatriz.trim());
    const estab = escapeXml(data.estab.padStart(3, '0'));
    const ptoEmi = escapeXml(data.ptoEmi.padStart(3, '0'));
    const secuencial = escapeXml(data.secuencial.padStart(9, '0'));

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<comprobanteRetencion id="comprobante" version="2.0.0">\n`;

    // ==========================================
    // 1. infoTributaria
    // ==========================================
    xml += `  <infoTributaria>\n`;
    xml += `    <ambiente>${data.ambiente}</ambiente>\n`;
    xml += `    <tipoEmision>${data.tipoEmision || '1'}</tipoEmision>\n`;
    xml += `    <razonSocial>${razonSocial}</razonSocial>\n`;
    if (nombreComercial) {
      xml += `    <nombreComercial>${nombreComercial}</nombreComercial>\n`;
    }
    xml += `    <ruc>${rucEmisor}</ruc>\n`;
    xml += `    <claveAcceso>${claveAcceso}</claveAcceso>\n`;
    xml += `    <codDoc>07</codDoc>\n`;
    xml += `    <estab>${estab}</estab>\n`;
    xml += `    <ptoEmi>${ptoEmi}</ptoEmi>\n`;
    xml += `    <secuencial>${secuencial}</secuencial>\n`;
    xml += `    <dirMatriz>${dirMatriz}</dirMatriz>\n`;

    // Régimen Microempresas (si aplica)
    if (data.regimenMicroempresas) {
      xml += `    <regimenMicroempresas>${escapeXml(data.regimenMicroempresas)}</regimenMicroempresas>\n`;
    }
    // Régimen RIMPE (si aplica)
    if (data.contribuyenteRimpe) {
      xml += `    <contribuyenteRimpe>${escapeXml(data.contribuyenteRimpe)}</contribuyenteRimpe>\n`;
    }
    // Agente de Retención (Resolución)
    if (data.agenteRetencion) {
      xml += `    <agenteRetencion>${escapeXml(data.agenteRetencion)}</agenteRetencion>\n`;
    }
    xml += `  </infoTributaria>\n`;

    // ==========================================
    // 2. infoCompRetencion
    // ==========================================
    xml += `  <infoCompRetencion>\n`;
    xml += `    <fechaEmision>${escapeXml(data.fechaEmision.trim())}</fechaEmision>\n`;
    if (data.dirEstablecimiento) {
      xml += `    <dirEstablecimiento>${escapeXml(data.dirEstablecimiento.trim())}</dirEstablecimiento>\n`;
    }
    if (data.contribuyenteEspecial) {
      xml += `    <contribuyenteEspecial>${escapeXml(data.contribuyenteEspecial.trim())}</contribuyenteEspecial>\n`;
    }
    xml += `    <obligadoContabilidad>${data.obligadoContabilidad || 'NO'}</obligadoContabilidad>\n`;
    xml += `    <tipoIdentificacionSujetoRetenido>${data.tipoIdentificacionSujetoRetenido}</tipoIdentificacionSujetoRetenido>\n`;
    if (data.tipoSujetoRetenido) {
      xml += `    <tipoSujetoRetenido>${data.tipoSujetoRetenido}</tipoSujetoRetenido>\n`;
    }
    xml += `    <parteRel>${data.parteRel || 'NO'}</parteRel>\n`;
    xml += `    <razonSocialSujetoRetenido>${escapeXml(data.razonSocialSujetoRetenido.trim())}</razonSocialSujetoRetenido>\n`;
    xml += `    <identificacionSujetoRetenido>${escapeXml(data.identificacionSujetoRetenido.trim())}</identificacionSujetoRetenido>\n`;
    xml += `    <periodoFiscal>${escapeXml(data.periodoFiscal.trim())}</periodoFiscal>\n`;
    xml += `  </infoCompRetencion>\n`;

    // ==========================================
    // 3. docsSustento (ATS v2.0.0)
    // ==========================================
    xml += `  <docsSustento>\n`;
    for (const doc of data.docsSustento) {
      xml += `    <docSustento>\n`;
      xml += `      <codSustento>${escapeXml(doc.codSustento)}</codSustento>\n`;
      xml += `      <codDocSustento>${escapeXml(doc.codDocSustento)}</codDocSustento>\n`;
      
      const cleanNumDoc = (doc.numDocSustento || '').replace(/-/g, '').trim();
      xml += `      <numDocSustento>${escapeXml(cleanNumDoc)}</numDocSustento>\n`;
      xml += `      <fechaEmisionDocSustento>${escapeXml(doc.fechaEmisionDocSustento)}</fechaEmisionDocSustento>\n`;
      
      if (doc.fechaRegistroContable) {
        xml += `      <fechaRegistroContable>${escapeXml(doc.fechaRegistroContable)}</fechaRegistroContable>\n`;
      }
      if (doc.numAutDocSustento) {
        xml += `      <numAutDocSustento>${escapeXml(doc.numAutDocSustento.trim())}</numAutDocSustento>\n`;
      }
      
      xml += `      <pagoLocExt>${doc.pagoLocExt || '01'}</pagoLocExt>\n`;
      
      if (doc.pagoLocExt === '02') {
        if (doc.tipoRegi) xml += `      <tipoRegi>${doc.tipoRegi}</tipoRegi>\n`;
        if (doc.paisEfecPago) xml += `      <paisEfecPago>${escapeXml(doc.paisEfecPago)}</paisEfecPago>\n`;
        if (doc.aplicConvDobTrib) xml += `      <aplicConvDobTrib>${doc.aplicConvDobTrib}</aplicConvDobTrib>\n`;
        if (doc.pagExtSujRetNorLeg) xml += `      <pagExtSujRetNorLeg>${doc.pagExtSujRetNorLeg}</pagExtSujRetNorLeg>\n`;
      }

      xml += `      <totalSinImpuestos>${doc.totalSinImpuestos.toFixed(2)}</totalSinImpuestos>\n`;
      xml += `      <importeTotal>${doc.importeTotal.toFixed(2)}</importeTotal>\n`;

      // Sub-nodo <impuestosDocSustento>
      if (Array.isArray(doc.impuestosDocSustento) && doc.impuestosDocSustento.length > 0) {
        xml += `      <impuestosDocSustento>\n`;
        for (const imp of doc.impuestosDocSustento) {
          xml += `        <impuestoDocSustento>\n`;
          xml += `          <codImpuestoDocSustento>${imp.codImpuestoDocSustento}</codImpuestoDocSustento>\n`;
          xml += `          <codigoPorcentaje>${imp.codigoPorcentaje}</codigoPorcentaje>\n`;
          xml += `          <baseImponible>${imp.baseImponible.toFixed(2)}</baseImponible>\n`;
          xml += `          <tarifa>${imp.tarifa.toFixed(2)}</tarifa>\n`;
          xml += `          <valorImpuesto>${imp.valorImpuesto.toFixed(2)}</valorImpuesto>\n`;
          xml += `        </impuestoDocSustento>\n`;
        }
        xml += `      </impuestosDocSustento>\n`;
      }

      // Sub-nodo <retenciones>
      if (Array.isArray(doc.retenciones) && doc.retenciones.length > 0) {
        xml += `      <retenciones>\n`;
        for (const ret of doc.retenciones) {
          xml += `        <retencion>\n`;
          xml += `          <codigo>${ret.codigo}</codigo>\n`;
          xml += `          <codigoRetencion>${escapeXml(ret.codigoRetencion)}</codigoRetencion>\n`;
          xml += `          <baseImponible>${ret.baseImponible.toFixed(2)}</baseImponible>\n`;
          xml += `          <porcentajeRetener>${ret.porcentajeRetener.toFixed(2)}</porcentajeRetener>\n`;
          xml += `          <valorRetenido>${ret.valorRetenido.toFixed(2)}</valorRetenido>\n`;
          xml += `        </retencion>\n`;
        }
        xml += `      </retenciones>\n`;
      }

      // Sub-nodo <pagos>
      if (Array.isArray(doc.pagos) && doc.pagos.length > 0) {
        xml += `      <pagos>\n`;
        for (const pago of doc.pagos) {
          xml += `        <pago>\n`;
          xml += `          <formaPago>${pago.formaPago || '01'}</formaPago>\n`;
          xml += `          <total>${pago.total.toFixed(2)}</total>\n`;
          if (pago.plazo !== undefined && pago.plazo !== null) {
            xml += `          <plazo>${pago.plazo}</plazo>\n`;
          }
          if (pago.unidadTiempo) {
            xml += `          <unidadTiempo>${escapeXml(pago.unidadTiempo)}</unidadTiempo>\n`;
          }
          xml += `        </pago>\n`;
        }
        xml += `      </pagos>\n`;
      }

      xml += `    </docSustento>\n`;
    }
    xml += `  </docsSustento>\n`;

    // ==========================================
    // 4. infoAdicional
    // ==========================================
    const adicionales: Array<{ nombre: string; valor: string }> = [];

    if (data.emailSujetoRetenido) {
      adicionales.push({ nombre: 'Email', valor: data.emailSujetoRetenido });
    }
    if (data.telefonoSujetoRetenido) {
      adicionales.push({ nombre: 'Teléfono', valor: data.telefonoSujetoRetenido });
    }
    if (data.direccionSujetoRetenido) {
      adicionales.push({ nombre: 'Dirección', valor: data.direccionSujetoRetenido });
    }

    // Requisito Sección 16: Si es software de terceros, incluir RUC Proveedor
    const softwareProviderRuc = typeof localStorage !== 'undefined' ? localStorage.getItem('ferreteria_sri_provider_ruc') : null;
    if (softwareProviderRuc && /^\d{13}$/.test(softwareProviderRuc.trim())) {
      adicionales.push({ nombre: 'RUC Proveedor', valor: softwareProviderRuc.trim() });
    }

    if (Array.isArray(data.infoAdicional)) {
      for (const item of data.infoAdicional) {
        if (item.nombre && item.valor) {
          adicionales.push(item);
        }
      }
    }

    if (adicionales.length > 0) {
      xml += `  <infoAdicional>\n`;
      for (const adic of adicionales) {
        xml += `    <campoAdicional nombre="${escapeXml(adic.nombre)}">${escapeXml(adic.valor)}</campoAdicional>\n`;
      }
      xml += `  </infoAdicional>\n`;
    }

    xml += `</comprobanteRetencion>`;

    return { xml, claveAcceso };
  }
}

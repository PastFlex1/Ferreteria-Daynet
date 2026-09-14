/**
 * @fileOverview Mapeador puro del modelo de dominio frontend (RetentionDraft)
 * a la estructura requerida por el generador XML ATS 2.0.0 (SRIRetentionData).
 */

import { RetentionDraft, SRIRetentionData, DocSustento } from '../../types/retention';

export class RetentionDraftMapper {
  /**
   * Transforma un borrador RetentionDraft normalizado en SRIRetentionData
   * para la serialización del XML sin firma.
   */
  public static toSriData(draft: RetentionDraft): SRIRetentionData {
    const docsSustento: DocSustento[] = draft.supportDocuments.map((doc) => {
      const isExterior = doc.pagoLocExt === '02';
      return {
        id: doc.id,
        codSustento: doc.codSustento,
        codDocSustento: doc.codDocSustento,
        numDocSustento: (doc.numDocSustento || '').replace(/\D/g, '').padStart(15, '0').slice(-15),
        fechaEmisionDocSustento: doc.fechaEmisionDocSustento,
        fechaRegistroContable: doc.fechaRegistroContable || undefined,
        numAutDocSustento: doc.numAutDocSustento ? doc.numAutDocSustento.trim() : undefined,
        pagoLocExt: doc.pagoLocExt,
        tipoRegi: isExterior ? doc.foreignPayment?.tipoRegi : undefined,
        paisEfecPago: isExterior ? doc.foreignPayment?.paisEfecPago : undefined,
        aplicConvDobTrib: isExterior ? doc.foreignPayment?.aplicConvDobTrib : undefined,
        pagExtSujRetNorLeg: isExterior ? doc.foreignPayment?.pagExtSujRetNorLeg : undefined,
        totalSinImpuestos: doc.totalSinImpuestos,
        importeTotal: doc.importeTotal,
        impuestosDocSustento: doc.taxes,
        retenciones: doc.withholdings,
        pagos: doc.payments,
      };
    });

    return {
      rucEmisor: draft.issuer.ruc.trim(),
      razonSocialEmisor: draft.issuer.razonSocial.trim(),
      nombreComercialEmisor: draft.issuer.nombreComercial ? draft.issuer.nombreComercial.trim() : undefined,
      dirMatriz: draft.issuer.dirMatriz.trim(),
      dirEstablecimiento: draft.issuer.dirEstablecimiento ? draft.issuer.dirEstablecimiento.trim() : undefined,
      estab: draft.issuer.estab.padStart(3, '0'),
      ptoEmi: draft.issuer.ptoEmi.padStart(3, '0'),
      secuencial: draft.retentionInfo.secuencial.padStart(9, '0'),
      fechaEmision: draft.retentionInfo.fechaEmision,
      ambiente: draft.retentionInfo.ambiente,
      tipoEmision: draft.retentionInfo.tipoEmision || '1',
      claveAcceso: draft.retentionInfo.claveAcceso || draft.sriReservation?.claveAcceso,

      // Regímenes
      obligadoContabilidad: draft.issuer.obligadoContabilidad,
      contribuyenteEspecial: draft.issuer.contribuyenteEspecial,
      agenteRetencion: draft.issuer.agenteRetencion,
      contribuyenteRimpe: draft.issuer.contribuyenteRimpe,
      regimenMicroempresas: draft.issuer.regimenMicroempresas,

      // Sujeto Retenido
      tipoIdentificacionSujetoRetenido: draft.retainedSubject.tipoIdentificacion,
      tipoSujetoRetenido: draft.retainedSubject.tipoSujetoRetenido,
      parteRel: draft.retentionInfo.parteRel || 'NO',
      razonSocialSujetoRetenido: draft.retainedSubject.razonSocial.trim(),
      identificacionSujetoRetenido: draft.retainedSubject.identificacion.trim(),
      periodoFiscal: draft.retentionInfo.periodoFiscal,

      // Documentos de sustento
      docsSustento,

      // Información adicional (administrativa)
      emailSujetoRetenido: draft.retainedSubject.email,
      telefonoSujetoRetenido: draft.retainedSubject.telefono,
      direccionSujetoRetenido: draft.retainedSubject.direccion,
      infoAdicional: draft.additionalInfo,
    };
  }
}

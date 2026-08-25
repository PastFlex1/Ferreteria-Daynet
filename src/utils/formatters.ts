import { DocumentType, Invoice, StoreSettings } from '../types';

export const formatCurrency = (amount: number, symbol: string = '$'): string => {
  if (amount == null || isNaN(amount)) {
    return `${symbol} 0.00`;
  }
  return `${symbol} ${amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatFullDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const generateDocumentNumber = (
  docType: DocumentType,
  settings: StoreSettings,
  establishment: string = '001',
  emissionPoint: string = '001',
  secInvoice: string = '000000001',
  secBoleta: string = '000001',
  secQuote: string = '000001'
): { series: string; number: number; fullNumber: string } => {
  if (docType === 'FACTURA') {
    const est = (establishment || '001').padStart(3, '0');
    const pto = (emissionPoint || '001').padStart(3, '0');
    const seq = (secInvoice || settings.nextInvoiceNumber.toString()).padStart(9, '0');
    return {
      series: `${est}-${pto}`,
      number: parseInt(seq, 10) || 1,
      fullNumber: `${est}-${pto}-${seq}`,
    };
  } else if (docType === 'BOLETA') {
    const seq = (secBoleta || settings.nextTicketNumber.toString()).padStart(6, '0');
    return {
      series: 'NV',
      number: parseInt(seq, 10) || 1,
      fullNumber: `#${seq}`,
    };
  } else {
    const seq = (secQuote || settings.nextQuoteNumber.toString()).padStart(6, '0');
    return {
      series: 'COT',
      number: parseInt(seq, 10) || 1,
      fullNumber: `COT-${seq}`,
    };
  }
};

export const getDocumentTypeName = (docType: DocumentType): string => {
  switch (docType) {
    case 'FACTURA':
      return 'Factura Electrónica';
    case 'BOLETA':
      return 'Boleta / Ticket de Venta';
    case 'COTIZACION':
      return 'Cotización / Proforma';
  }
};

export const getPaymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'EFECTIVO':
      return 'Efectivo';
    case 'TARJETA_DEBITO':
      return 'Tarjeta de Débito';
    case 'TARJETA_CREDITO':
      return 'Tarjeta de Crédito';
    case 'TRANSFERENCIA':
      return 'Transferencia Bancaria';
    case 'CREDITO_CLIENTE':
      return 'Crédito / Cta. Corriente';
    default:
      return method;
  }
};

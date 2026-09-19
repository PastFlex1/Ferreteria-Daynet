import { DocumentType, Invoice, StoreSettings } from '../types';

export const formatCurrency = (amount: number | string | null | undefined, symbol: string = '$', maxDecimals: number = 2): string => {
  if (amount == null || amount === '') {
    return `${symbol} 0.00`;
  }
  const cleanStr = typeof amount === 'string' ? amount.trim().replace(/,/g, '.') : amount;
  const num = typeof cleanStr === 'string' ? parseFloat(cleanStr) : cleanStr;
  if (isNaN(num)) {
    return `${symbol} 0.00`;
  }
  return `${symbol} ${num.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  })}`;
};

export const formatCostCurrency = (amount: number | string | null | undefined, symbol: string = '$'): string => {
  return formatCurrency(amount, symbol, 4);
};

export const formatDecimalNumber = (amount: number | string | null | undefined, minDecimals: number = 2, maxDecimals: number = 2): string => {
  if (amount == null || amount === '') {
    return '0.00';
  }
  const cleanStr = typeof amount === 'string' ? amount.trim().replace(/,/g, '.') : amount;
  const num = typeof cleanStr === 'string' ? parseFloat(cleanStr) : cleanStr;
  if (isNaN(num)) {
    return '0.00';
  }
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
};

export const getEcuadorianDateTime = (dateInput?: Date | string | number | null) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const formatter = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(validDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const year = partMap.year || '2026';
  const month = partMap.month || '01';
  const day = partMap.day || '01';
  const hour = partMap.hour || '00';
  const minute = partMap.minute || '00';
  const second = partMap.second || '00';

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}:${second}`;
  const timeShort = `${hour}:${minute}`;
  const isoLocal = `${dateStr}T${timeStr}-05:00`;

  return {
    date: validDate,
    dateStr,
    timeStr,
    timeShort,
    isoLocal,
    formatted: `${day}/${month}/${year} ${hour}:${minute}`,
    day,
    month,
    year,
    hour,
    minute,
    second,
  };
};

export const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatFullDate = (dateString?: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString('es-EC', {
    timeZone: 'America/Guayaquil',
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
    case '01':
      return 'Efectivo';
    case 'TARJETA_DEBITO':
    case '16':
      return 'Tarjeta de Débito';
    case 'TARJETA_CREDITO':
    case '19':
      return 'Tarjeta de Crédito';
    case 'TRANSFERENCIA':
    case '20':
      return 'Transferencia Bancaria';
    case 'COMPENSACION':
    case '15':
      return 'Compensación de Deudas';
    case 'ENDOSO':
    case '21':
      return 'Endoso de Títulos';
    case 'CREDITO_CLIENTE':
      return 'Crédito / Cta. Corriente';
    default:
      return method;
  }
};

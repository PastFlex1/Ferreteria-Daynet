/**
 * @fileOverview Utilidades para la gestión de cheques girados, numeración correlativa y conciliación bancaria.
 */

export interface CheckSummaryItem {
  id: string;
  checkNumber: string;
  bankName: string;
  issueDate: string;
  deliveryDate?: string;
  paymentDate: string;
  clearedDate?: string;
  beneficiary: string;
  supplierId?: string;
  payableInvoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  concept: string;
  status: 'EMITIDO' | 'ENTREGADO' | 'COBRADO' | 'ANULADO' | 'GIRADO';
  journalEntryId?: string;
  notes?: string;
}

/**
 * Obtiene el siguiente número correlativo de cheque para una entidad bancaria específica.
 * Si no existen cheques previos, inicia en '000101'.
 */
export function getNextCorrelativeCheck(checks: any[], bankName: string = ''): string {
  if (!checks || checks.length === 0) {
    return '000101';
  }

  const normalizedTarget = (bankName || '').toLowerCase().trim();
  
  // Filtrar cheques que correspondan al mismo banco (o todos si no se especificó)
  const bankChecks = normalizedTarget
    ? checks.filter(c => (c.bankName || '').toLowerCase().trim().includes(normalizedTarget) || normalizedTarget.includes((c.bankName || '').toLowerCase().trim()))
    : checks;

  if (bankChecks.length === 0) {
    return '000101';
  }

  let maxNumber = 100;

  bankChecks.forEach(chk => {
    const raw = String(chk.checkNumber || '').trim();
    const digitsOnly = raw.replace(/\D/g, '');
    const parsed = parseInt(digitsOnly, 10);
    if (!isNaN(parsed) && parsed > maxNumber) {
      maxNumber = parsed;
    }
  });

  const nextNum = maxNumber + 1;
  return String(nextNum).padStart(6, '0');
}

/**
 * Determina si un cheque se encuentra actualmente "en tránsito"
 * (Emitido o Entregado al proveedor pero no debitado por el banco en extracto).
 */
export function isCheckInTransit(status: string | undefined): boolean {
  if (!status) return false;
  return ['EMITIDO', 'ENTREGADO', 'GIRADO'].includes(status.toUpperCase());
}

/**
 * Mapeo de estilos y etiquetas según el estado del ciclo de vida del cheque.
 */
export function getCheckStatusBadge(status: string | undefined): { label: string; className: string; description: string } {
  switch ((status || '').toUpperCase()) {
    case 'EMITIDO':
    case 'GIRADO':
      return {
        label: 'EMITIDO (EN TRÁNSITO)',
        className: 'bg-amber-50 border-amber-200 text-amber-800',
        description: 'Cheque firmado y registrado en libros contables. Fondos en tránsito.'
      };
    case 'ENTREGADO':
      return {
        label: 'ENTREGADO A PROVEEDOR',
        className: 'bg-indigo-50 border-indigo-200 text-indigo-700',
        description: 'Cheque retirado por el proveedor. Pendiente de presentación en ventanilla/compensación.'
      };
    case 'COBRADO':
      return {
        label: 'COBRADO / CONCILIADO',
        className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        description: 'Cheque debitado por la entidad financiera. Conciliado con extracto bancario.'
      };
    case 'ANULADO':
      return {
        label: 'ANULADO',
        className: 'bg-rose-50 border-rose-200 text-rose-700 line-through',
        description: 'Documento invalidado. Obligación reactivada o asiento revertido.'
      };
    default:
      return {
        label: status || 'PENDIENTE',
        className: 'bg-slate-100 border-slate-200 text-slate-700',
        description: 'Estado pendiente de confirmación'
      };
  }
}

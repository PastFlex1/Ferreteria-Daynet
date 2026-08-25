import { CartItem, InvoiceItem } from '../types';
import { SriTotalsBreakdown } from '../components/POS/SriTotalsTable';

export function calculateSriTotals(
  items: (CartItem | InvoiceItem)[],
  defaultTaxRate: number = 15,
  propina10Enabled: boolean = false
): SriTotalsBreakdown {
  let subtotalSinImpuestos = 0;
  let subtotal15 = 0;
  let subtotal5 = 0;
  let subtotalEspecial = 0;
  let subtotal0 = 0;
  let subtotalNoObjeto = 0;
  let subtotalExento = 0;
  let totalDescuento = 0;
  let iva15 = 0;
  let iva5 = 0;
  let ivaEspecial = 0;

  items.forEach((item) => {
    const itemSubtotal = item.subtotal || item.unitPrice * item.quantity;
    const itemDiscount = (itemSubtotal * (item.discountPercent || 0)) / 100;
    const baseAfterDiscount = itemSubtotal - itemDiscount;

    subtotalSinImpuestos += itemSubtotal;
    totalDescuento += itemDiscount;

    // Check product or item tax rate
    let taxRate = defaultTaxRate;
    if ('product' in item && item.product && typeof item.product.taxRate === 'number') {
      taxRate = item.product.taxRate;
    } else if ('taxRate' in item && typeof (item as any).taxRate === 'number') {
      taxRate = (item as any).taxRate;
    } else if ('taxPercent' in item && typeof (item as any).taxPercent === 'number') {
      taxRate = (item as any).taxPercent;
    } else if (item.taxAmount === 0 && itemSubtotal > 0) {
      taxRate = 0;
    } else if (item.taxAmount > 0 && baseAfterDiscount > 0) {
      // Inferred rate from taxAmount / base
      const calcPct = Math.round((item.taxAmount / baseAfterDiscount) * 100);
      taxRate = calcPct;
    }

    if (taxRate === 15) {
      subtotal15 += baseAfterDiscount;
      iva15 += item.taxAmount !== undefined ? item.taxAmount : (baseAfterDiscount * 0.15);
    } else if (taxRate === 5) {
      subtotal5 += baseAfterDiscount;
      iva5 += item.taxAmount !== undefined ? item.taxAmount : (baseAfterDiscount * 0.05);
    } else if (taxRate === 0) {
      subtotal0 += baseAfterDiscount;
    } else {
      subtotalEspecial += baseAfterDiscount;
      ivaEspecial += item.taxAmount !== undefined ? item.taxAmount : (baseAfterDiscount * (taxRate / 100));
    }
  });

  const propina10Amount = propina10Enabled ? (subtotal15 + subtotal5 + subtotal0) * 0.10 : 0;
  const valorICE = 0;
  const valorAPagar = (subtotal15 + subtotal5 + subtotal0) + iva15 + iva5 + ivaEspecial + valorICE + propina10Amount;

  return {
    subtotalSinImpuestos,
    subtotal15,
    subtotal5,
    subtotalEspecial,
    subtotal0,
    subtotalNoObjeto,
    subtotalExento,
    totalDescuento,
    valorIce: valorICE,
    iva15,
    iva5,
    ivaEspecial,
    propina10Enabled,
    propina10Amount,
    valorAPagar,
  };
}

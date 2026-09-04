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

  const rateBreakdowns: Record<number, { base: number; tax: number }> = {};

  items.forEach((item) => {
    const rawSubtotal = item.subtotal || item.unitPrice * item.quantity;
    const itemSubtotal = Math.round(rawSubtotal * 100) / 100;
    const itemDiscount = Math.round(((itemSubtotal * (item.discountPercent || 0)) / 100) * 100) / 100;
    const baseAfterDiscount = Math.round((itemSubtotal - itemDiscount) * 100) / 100;

    subtotalSinImpuestos = Math.round((subtotalSinImpuestos + baseAfterDiscount) * 100) / 100;
    totalDescuento = Math.round((totalDescuento + itemDiscount) * 100) / 100;

    // Check product or item tax rate
    let taxRate = defaultTaxRate;
    if ('taxRate' in item && typeof (item as any).taxRate === 'number') {
      taxRate = (item as any).taxRate;
    } else if ('product' in item && item.product && typeof item.product.taxRate === 'number') {
      taxRate = item.product.taxRate;
    } else if ('taxPercent' in item && typeof (item as any).taxPercent === 'number') {
      taxRate = (item as any).taxPercent;
    } else if (item.taxAmount === 0 && itemSubtotal > 0) {
      taxRate = 0;
    } else if (item.taxAmount > 0 && baseAfterDiscount > 0) {
      const calcPct = Math.round((item.taxAmount / baseAfterDiscount) * 100);
      taxRate = calcPct;
    }

    const calculatedTax = item.taxAmount !== undefined && item.taxAmount >= 0
      ? Math.round(item.taxAmount * 100) / 100
      : (taxRate > 0 ? Math.round(baseAfterDiscount * (taxRate / 100) * 100) / 100 : 0);

    if (!rateBreakdowns[taxRate]) {
      rateBreakdowns[taxRate] = { base: 0, tax: 0 };
    }
    rateBreakdowns[taxRate].base = Math.round((rateBreakdowns[taxRate].base + baseAfterDiscount) * 100) / 100;
    rateBreakdowns[taxRate].tax = Math.round((rateBreakdowns[taxRate].tax + calculatedTax) * 100) / 100;

    if (taxRate === 15) {
      subtotal15 = Math.round((subtotal15 + baseAfterDiscount) * 100) / 100;
      iva15 = Math.round((iva15 + calculatedTax) * 100) / 100;
    } else if (taxRate === 5) {
      subtotal5 = Math.round((subtotal5 + baseAfterDiscount) * 100) / 100;
      iva5 = Math.round((iva5 + calculatedTax) * 100) / 100;
    } else if (taxRate === 0) {
      subtotal0 = Math.round((subtotal0 + baseAfterDiscount) * 100) / 100;
    } else {
      subtotalEspecial = Math.round((subtotalEspecial + baseAfterDiscount) * 100) / 100;
      ivaEspecial = Math.round((ivaEspecial + calculatedTax) * 100) / 100;
    }
  });

  const totalTaxableBase = Math.round((subtotal15 + subtotal5 + subtotalEspecial + subtotal0 + subtotalNoObjeto + subtotalExento) * 100) / 100;
  const totalIva = Math.round((iva15 + iva5 + ivaEspecial) * 100) / 100;
  const propina10Amount = propina10Enabled ? Math.round((totalTaxableBase * 0.10) * 100) / 100 : 0;
  const valorICE = 0;
  const valorAPagar = Math.round((totalTaxableBase + totalIva + valorICE + propina10Amount) * 100) / 100;

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
    total: valorAPagar,
    rateBreakdowns,
  };
}

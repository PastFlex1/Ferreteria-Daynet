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
      const calcPct = Math.round((item.taxAmount / baseAfterDiscount) * 100);
      taxRate = calcPct;
    }

    const calculatedTax = item.taxAmount !== undefined ? item.taxAmount : (baseAfterDiscount * (taxRate / 100));

    if (!rateBreakdowns[taxRate]) {
      rateBreakdowns[taxRate] = { base: 0, tax: 0 };
    }
    rateBreakdowns[taxRate].base += baseAfterDiscount;
    rateBreakdowns[taxRate].tax += calculatedTax;

    if (taxRate === 15) {
      subtotal15 += baseAfterDiscount;
      iva15 += calculatedTax;
    } else if (taxRate === 5) {
      subtotal5 += baseAfterDiscount;
      iva5 += calculatedTax;
    } else if (taxRate === 0) {
      subtotal0 += baseAfterDiscount;
    } else {
      subtotalEspecial += baseAfterDiscount;
      ivaEspecial += calculatedTax;
    }
  });

  const totalTaxableBase = subtotal15 + subtotal5 + subtotalEspecial + subtotal0 + subtotalNoObjeto + subtotalExento;
  const totalIva = iva15 + iva5 + ivaEspecial;
  const propina10Amount = propina10Enabled ? (totalTaxableBase * 0.10) : 0;
  const valorICE = 0;
  const valorAPagar = totalTaxableBase + totalIva + valorICE + propina10Amount;

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
    rateBreakdowns,
  };
}

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
  let totalDescuentoConIva = 0;
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

    const itemDiscountConIva = Math.round((itemDiscount * (1 + (taxRate / 100))) * 100) / 100;
    totalDescuentoConIva = Math.round((totalDescuentoConIva + itemDiscountConIva) * 100) / 100;

    const calculatedTax = item.taxAmount !== undefined && item.taxAmount >= 0
      ? Math.round(item.taxAmount * 100) / 100
      : (taxRate > 0 ? Math.round(baseAfterDiscount * (taxRate / 100) * 100) / 100 : 0);

    if (!rateBreakdowns[taxRate]) {
      rateBreakdowns[taxRate] = { base: 0, tax: 0 };
    }
    rateBreakdowns[taxRate].base = Math.round((rateBreakdowns[taxRate].base + baseAfterDiscount) * 100) / 100;

    if (taxRate === 15) {
      subtotal15 = Math.round((subtotal15 + baseAfterDiscount) * 100) / 100;
    } else if (taxRate === 5) {
      subtotal5 = Math.round((subtotal5 + baseAfterDiscount) * 100) / 100;
    } else if (taxRate === 0) {
      subtotal0 = Math.round((subtotal0 + baseAfterDiscount) * 100) / 100;
    } else {
      subtotalEspecial = Math.round((subtotalEspecial + baseAfterDiscount) * 100) / 100;
    }
  });

  // Calcular impuestos consolidados directamente sobre las bases imponibles por tarifa (norma tributaria SRI)
  // Esto elimina el error acumulativo de redondear centavos línea por línea que sumaba 1 a 3 centavos de más.
  iva15 = Math.round(subtotal15 * 0.15 * 100) / 100;
  iva5 = Math.round(subtotal5 * 0.05 * 100) / 100;

  Object.keys(rateBreakdowns).forEach((rateKey) => {
    const rate = Number(rateKey);
    const tax = rate > 0 ? Math.round(rateBreakdowns[rate].base * (rate / 100) * 100) / 100 : 0;
    rateBreakdowns[rate].tax = tax;
    if (rate !== 15 && rate !== 5 && rate !== 0) {
      ivaEspecial = Math.round((ivaEspecial + tax) * 100) / 100;
    }
  });
  if (rateBreakdowns[15]) rateBreakdowns[15].tax = iva15;
  if (rateBreakdowns[5]) rateBreakdowns[5].tax = iva5;

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
    totalDescuentoConIva,
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

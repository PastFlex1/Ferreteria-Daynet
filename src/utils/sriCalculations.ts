import { CartItem, InvoiceItem } from '../types';
import { SriTotalsBreakdown } from '../components/POS/SriTotalsTable';

export function calculateCartItemFinancialsFromPvp(
  quantity: number,
  unitPricePvp: number,
  taxRatePercent: number,
  discountPercent: number = 0
) {
  const taxRate = taxRatePercent / 100;
  const safeDiscount = Math.max(0, Math.min(100, discountPercent));

  // 1. Total exacto a cobrar al cliente con PVP final
  const grossTotal = Math.round(quantity * unitPricePvp * 100) / 100;
  const discountTotalPvp = Math.round(grossTotal * (safeDiscount / 100) * 100) / 100;
  const itemTotal = Math.round((grossTotal - discountTotalPvp) * 100) / 100;

  let baseAfterDiscount: number;
  let itemTaxAmount: number;

  if (taxRate > 0) {
    // Desglose hacia atrás: Base Imponible neta sin IVA
    baseAfterDiscount = Math.round((itemTotal / (1 + taxRate)) * 100) / 100;
    // Impuesto = Total - Base (Garantiza matemáticamente que base + impuesto === total)
    itemTaxAmount = Math.round((itemTotal - baseAfterDiscount) * 100) / 100;
  } else {
    baseAfterDiscount = itemTotal;
    itemTaxAmount = 0;
  }

  // Desglose del subtotal antes de descuento y descuento sin IVA
  let itemSubtotal: number;
  let itemDiscountAmount: number;
  if (taxRate > 0) {
    itemSubtotal = Math.round((grossTotal / (1 + taxRate)) * 100) / 100;
    itemDiscountAmount = Math.round((itemSubtotal - baseAfterDiscount) * 100) / 100;
  } else {
    itemSubtotal = grossTotal;
    itemDiscountAmount = discountTotalPvp;
  }

  // Precio unitario sin IVA para SRI (hasta 6 decimales de precisión)
  const baseUnitPrice = quantity > 0 ? (itemSubtotal / quantity) : (taxRate > 0 ? unitPricePvp / (1 + taxRate) : unitPricePvp);

  return {
    unitPricePvp,
    baseUnitPrice,
    subtotal: itemSubtotal,
    discountAmount: itemDiscountAmount,
    baseAfterDiscount,
    taxAmount: itemTaxAmount,
    total: itemTotal,
  };
}

export function calculateCartItemFinancials(
  quantity: number,
  baseUnitPrice: number,
  taxRatePercent: number,
  discountPercent: number = 0
) {
  const taxRate = taxRatePercent / 100;
  const unitPriceWithTax = Math.round(baseUnitPrice * (1 + taxRate) * 100) / 100;
  const safeDiscount = Math.max(0, Math.min(100, discountPercent));

  const itemSubtotal = Math.round(quantity * baseUnitPrice * 100) / 100;
  const itemDiscountAmount = Math.round((itemSubtotal * (safeDiscount / 100)) * 100) / 100;
  const baseAfterDiscount = Math.round((itemSubtotal - itemDiscountAmount) * 100) / 100;

  let itemTotal: number;
  let itemTaxAmount: number;

  if (taxRate > 0) {
    const rawTotalWithTax = quantity * unitPriceWithTax * (1 - safeDiscount / 100);
    itemTotal = Math.round(rawTotalWithTax * 100) / 100;
    itemTaxAmount = Math.round((itemTotal - baseAfterDiscount) * 100) / 100;

    // Control de seguridad: asegurar que itemTaxAmount no exceda la tolerancia SRI (+/- 0.01) frente al impuesto estándar
    const standardTax = Math.round(baseAfterDiscount * taxRate * 100) / 100;
    if (Math.round(Math.abs(itemTaxAmount - standardTax) * 100) / 100 > 0.01) {
      itemTaxAmount = standardTax;
      itemTotal = Math.round((baseAfterDiscount + itemTaxAmount) * 100) / 100;
    }
  } else {
    itemTaxAmount = 0;
    itemTotal = baseAfterDiscount;
  }

  return {
    subtotal: itemSubtotal,
    discountAmount: itemDiscountAmount,
    baseAfterDiscount,
    taxAmount: itemTaxAmount,
    total: itemTotal,
  };
}

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
  let sumItemTax15 = 0;
  let sumItemTax5 = 0;

  const rateBreakdowns: Record<number, { base: number; tax: number; sumItemTax: number }> = {};

  items.forEach((item) => {
    let rawSubtotal: number;
    if (item.subtotal !== undefined) {
      rawSubtotal = item.subtotal;
    } else if (item.total !== undefined && item.taxAmount !== undefined) {
      rawSubtotal = Math.round((item.total - item.taxAmount) * 100) / 100;
    } else {
      rawSubtotal = item.unitPrice * item.quantity;
    }
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
      rateBreakdowns[taxRate] = { base: 0, tax: 0, sumItemTax: 0 };
    }
    rateBreakdowns[taxRate].base = Math.round((rateBreakdowns[taxRate].base + baseAfterDiscount) * 100) / 100;
    rateBreakdowns[taxRate].sumItemTax = Math.round((rateBreakdowns[taxRate].sumItemTax + calculatedTax) * 100) / 100;

    if (taxRate === 15) {
      subtotal15 = Math.round((subtotal15 + baseAfterDiscount) * 100) / 100;
      sumItemTax15 = Math.round((sumItemTax15 + calculatedTax) * 100) / 100;
    } else if (taxRate === 5) {
      subtotal5 = Math.round((subtotal5 + baseAfterDiscount) * 100) / 100;
      sumItemTax5 = Math.round((sumItemTax5 + calculatedTax) * 100) / 100;
    } else if (taxRate === 0) {
      subtotal0 = Math.round((subtotal0 + baseAfterDiscount) * 100) / 100;
    } else {
      subtotalEspecial = Math.round((subtotalEspecial + baseAfterDiscount) * 100) / 100;
    }
  });

  // Calcular impuestos consolidados respetando la tolerancia normativa del SRI (+/- 0.01 por tarifa)
  // Esto previene discrepancias de 1 centavo en ventas al detalle por unidad (PVP) mientras mantiene validez legal ante el SRI.
  const standardIva15 = Math.round(subtotal15 * 0.15 * 100) / 100;
  const standardIva5 = Math.round(subtotal5 * 0.05 * 100) / 100;

  const iva15 = Math.round(Math.abs(sumItemTax15 - standardIva15) * 100) / 100 <= 0.01 ? sumItemTax15 : standardIva15;
  const iva5 = Math.round(Math.abs(sumItemTax5 - standardIva5) * 100) / 100 <= 0.01 ? sumItemTax5 : standardIva5;
  let ivaEspecial = 0;

  Object.keys(rateBreakdowns).forEach((rateKey) => {
    const rate = Number(rateKey);
    const standardTax = rate > 0 ? Math.round(rateBreakdowns[rate].base * (rate / 100) * 100) / 100 : 0;
    const finalTax = Math.round(Math.abs(rateBreakdowns[rate].sumItemTax - standardTax) * 100) / 100 <= 0.01
      ? rateBreakdowns[rate].sumItemTax
      : standardTax;
    rateBreakdowns[rate].tax = finalTax;
    if (rate !== 15 && rate !== 5 && rate !== 0) {
      ivaEspecial = Math.round((ivaEspecial + finalTax) * 100) / 100;
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

/**
 * Barcode Generator Utility
 * Generates standard compliant barcodes for inventory and point of sale.
 */

/**
 * Calculates EAN-13 checksum digit
 */
export function calculateEan13CheckDigit(code12Digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12Digits[i], 10) || 0;
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Generates an internal EAN-13 barcode (prefix 200-299 is internationally reserved for in-store use)
 * or country prefix 786 (Ecuador)
 */
export function generateEan13Barcode(prefix: string = '786'): string {
  // Ensure 12 digits before checksum
  const randomLength = 12 - prefix.length;
  let randomPart = '';
  for (let i = 0; i < randomLength; i++) {
    randomPart += Math.floor(Math.random() * 10).toString();
  }
  const first12 = (prefix + randomPart).slice(0, 12);
  const checkDigit = calculateEan13CheckDigit(first12);
  return first12 + checkDigit.toString();
}

/**
 * Generates an alphanumeric Code128 barcode based on SKU or standard format
 */
export function generateCode128Barcode(sku?: string): string {
  if (sku && sku.trim().length >= 3) {
    const cleanSku = sku.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return `${cleanSku}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const randomNum = Math.floor(10000000 + Math.random() * 90000000);
  return `FERR-${randomNum}`;
}

/**
 * Generates a clean numeric SKU/Barcode
 */
export function generateNumericBarcode(): string {
  const timestamp = Date.now().toString().slice(-8);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${timestamp}${rand}`;
}

/**
 * Validador oficial de identificación ecuatoriana (Cédula y RUC)
 * Implementa Algoritmo Módulo 10 y Módulo 11 oficial del SRI / Registro Civil.
 */
export function validateEcuadorianId(id: string): { isValid: boolean; type?: string; reason?: string } {
  if (!id) return { isValid: false, reason: 'Identificación vacía' };
  
  const clean = String(id).trim();

  // Consumidor Final especial
  if (clean === '9999999999999') {
    return { isValid: true, type: 'CONSUMIDOR_FINAL' };
  }

  // Debe ser puramente numérico
  if (!/^\d+$/.test(clean)) {
    return { isValid: false, reason: 'Contiene caracteres no numéricos' };
  }

  // Longitud debe ser 10 (Cédula) o 13 (RUC)
  if (clean.length !== 10 && clean.length !== 13) {
    return { isValid: false, reason: `Longitud inválida (${clean.length} dígitos, se esperan 10 o 13)` };
  }

  const prov = parseInt(clean.substring(0, 2), 10);
  if ((prov < 1 || prov > 24) && prov !== 30) {
    return { isValid: false, reason: `Código de provincia inválido: ${prov}` };
  }

  const tercerDigito = parseInt(clean.substring(2, 3), 10);

  // 1. CÉDULA DE IDENTIDAD O RUC PERSONA NATURAL (Tercer dígito < 6)
  if (tercerDigito < 6) {
    const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let val = parseInt(clean[i], 10) * coef[i];
      if (val >= 10) val -= 9;
      suma += val;
    }
    const digitoVerificador = parseInt(clean[9], 10);
    const residuo = suma % 10;
    const resultadoEsperado = residuo === 0 ? 0 : 10 - residuo;

    if (resultadoEsperado !== digitoVerificador) {
      return { isValid: false, reason: `Dígito verificador Módulo 10 erróneo (esperado ${resultadoEsperado}, obtenido ${digitoVerificador})` };
    }

    if (clean.length === 13) {
      const estab = clean.substring(10, 13);
      if (estab === '000') {
        return { isValid: false, reason: 'RUC con establecimiento 000 inválido' };
      }
      return { isValid: true, type: 'RUC_PERSONA_NATURAL' };
    }

    return { isValid: true, type: 'CEDULA' };
  }

  // 2. RUC SOCIEDADES PRIVADAS Y EXTRANJEROS (Tercer dígito = 9)
  if (tercerDigito === 9 && clean.length === 13) {
    const coef = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      suma += parseInt(clean[i], 10) * coef[i];
    }
    const digitoVerificador = parseInt(clean[9], 10);
    const residuo = suma % 11;
    const resultadoEsperado = residuo === 0 ? 0 : 11 - residuo;

    if (resultadoEsperado !== digitoVerificador) {
      return { isValid: false, reason: `Dígito verificador Módulo 11 (Sociedad Privada) erróneo` };
    }

    const estab = clean.substring(10, 13);
    if (estab === '000') {
      return { isValid: false, reason: 'RUC sociedad con establecimiento 000 inválido' };
    }

    return { isValid: true, type: 'RUC_SOCIEDAD_PRIVADA' };
  }

  // 3. RUC INSTITUCIONES PÚBLICAS (Tercer dígito = 6)
  if (tercerDigito === 6 && clean.length === 13) {
    const coef = [3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 8; i++) {
      suma += parseInt(clean[i], 10) * coef[i];
    }
    const digitoVerificador = parseInt(clean[8], 10);
    const residuo = suma % 11;
    const resultadoEsperado = residuo === 0 ? 0 : 11 - residuo;

    if (resultadoEsperado !== digitoVerificador) {
      return { isValid: false, reason: `Dígito verificador Módulo 11 (Sector Público) erróneo` };
    }

    return { isValid: true, type: 'RUC_SECTOR_PUBLICO' };
  }

  return { isValid: false, reason: `Tercer dígito '${tercerDigito}' incompatible con tipo de documento legal` };
}

/**
 * Validador de Partida Doble en Asientos Contables:
 * Debe == Haber con tolerancia máxima de 1 centavo
 */
export function validateJournalEntryBalance(entry: any): { isBalanced: boolean; totalDebit: number; totalCredit: number; diff: number } {
  let totalDebit = 0;
  let totalCredit = 0;

  if (Array.isArray(entry.items)) {
    for (const item of entry.items) {
      totalDebit += Number(item.debit || item.debe || 0);
      totalCredit += Number(item.credit || item.haber || 0);
    }
  } else {
    totalDebit = Number(entry.totalDebit || entry.debit || entry.totalDebe || 0);
    totalCredit = Number(entry.totalCredit || entry.credit || entry.totalHaber || 0);
  }

  totalDebit = Number(totalDebit.toFixed(2));
  totalCredit = Number(totalCredit.toFixed(2));
  const diff = Number(Math.abs(totalDebit - totalCredit).toFixed(2));

  return {
    isBalanced: diff < 0.01,
    totalDebit,
    totalCredit,
    diff
  };
}

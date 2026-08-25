function validateCedula(clean) {
  const coeffs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    let prod = parseInt(clean.charAt(i), 10) * coeffs[i];
    if (prod >= 10) {
      prod -= 9;
    }
    sum += prod;
  }
  const calculatedVerifier = (10 - (sum % 10)) % 10;
  return calculatedVerifier;
}
console.log(validateCedula('171829304'));

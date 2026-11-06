// Money is stored and computed in integer paise. Rupees only appear at the edges (display, Cashfree API).

export function rupeesToPaise(rupees: number) {
  return Math.round(rupees * 100);
}

/** Cashfree sends/receives decimal rupees (e.g. 546.00). */
export function providerAmountToPaise(amount: number | string) {
  return Math.round(Number(amount) * 100);
}

export function paiseToRupees(paise: number) {
  return paise / 100;
}

export function formatPaise(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

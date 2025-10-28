import { getCurrency } from './data.js'

export function sanitizeMoneyInput(str) {
  return parseInt(str.split('.')[0].replace(/\D/g, '')) || 0
}

export function money(int, mode) {
  const currency = getCurrency()

  const account = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  const netWorth = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumSignificantDigits: 3,
    notation: "compact",
  })

  if (mode === 'total') {
    return netWorth.format(int)
  }

  return account.format(int)
}

import { getCurrency } from './data.js'

export function sanitizeMoneyInput(str) {
  return parseInt(str.split('.')[0].replace(/\D/g, '')) || 0
}

export function money(int, mode) {
  const currency = getCurrency()
  let language = 'en-US'
  if (currency === 'PEN') {
    language = 'es-PE'
  }

  const account = new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  const netWorth = new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumSignificantDigits: 3,
    notation: "compact",
  })

  let value = account.format(int) 

  if (mode === 'total') {
    value = netWorth.format(int)
  }

  if (currency === 'PEN') {
    value = value.replace('S/', 'S/.')
  }

  return value 
}

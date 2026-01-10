import { getCurrency } from './data.js'

export function sanitizeMoneyInput(str) {
  // Try to evaluate as a math expression first
  const cleaned = str.replace(/[^\d+\-*/().\s]/g, '')
  try {
    const result = Function('"use strict"; return (' + cleaned + ')')()
    if (typeof result === 'number' && !isNaN(result)) {
      return Math.round(result)
    }
  } catch (e) {
    // If evaluation fails, fall back to original parsing
  }

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

  const compact = new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumSignificantDigits: 3,
    notation: "compact",
  })

  let value = account.format(int) 

  if (mode === 'compact') {
    value = compact.format(int)
  }

  if (currency === 'PEN') {
    value = value.replace('S/', 'S/.')
  }

  return value 
}

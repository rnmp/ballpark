const accountFormatter = new Intl.NumberFormat("en-US", { 
  style: "currency", 
  currency: "USD", 
  maximumFractionDigits: 0,
})

const netWorthFormatter = new Intl.NumberFormat("en-US", { 
  style: "currency", 
  currency: "USD", 
  maximumSignificantDigits: 3, 
  notation: "compact", 
})

export function sanitizeMoneyInput(str) {
  return parseInt(str.split('.')[0].replace(/\D/g, '')) || 0
}

export function money(int, mode) {
  if (mode === 'total') {
    return netWorthFormatter.format(int)
  }
  
  return accountFormatter.format(int)
}

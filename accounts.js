export function isLiability (account) {
  return ['car_loan', 'student_loan', 'mortgage'].includes(account.account_type)
}

export function accountEmoji(account) {
  switch (account.account_type) {
    case "savings": return '💰'
    case "investments": return '📈'
    case "property": return '🏠'
    case "student_loan": return '🎓'
    case "car_loan": return '🚗'
    case "mortgage": return '🏠'
    default: return '🏛️'
  }
}

export function accountValue(account) {
  const factor = isLiability(account) && account.value > 0 ? -1 : +1
  return (account.value * factor)
}

const formatter = new Intl.NumberFormat("en-US", { 
  style: "currency", 
  currency: "USD", 
  maximumSignificantDigits: 3, 
  notation: "compact", 
})

export function money(int) {
  return formatter.format(int)
}

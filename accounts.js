const ACCOUNT_TYPES = [
  'savings',
  'investments',
  'property',
  'valuable',
  'credit_card',
  'student_loan',
  'car_loan',
  'mortgage',
]

export function isLiability(accountType) {
  return ['car_loan', 'student_loan', 'mortgage', 'credit_card'].includes(accountType)
}

export function accountEmoji(accountType) {
  switch (accountType) {
    case "savings": return '💰'
    case "investments": return '📈'
    case "property": return '🏠'
    case "valuable": return '💎'
    case "student_loan": return '🎓'
    case "car_loan": return '🚗'
    case "mortgage": return '🏠'
    case "credit_card": return '💳'
    default: return '🏛️'
  }
}

export function accountLabel(accountType) {
  switch (accountType) {
    case "savings": return 'Savings'
    case "investments": return 'Investments'
    case "property": return 'Property'
    case "valuable": return 'Valuable'
    case "student_loan": return 'Student Loan'
    case "car_loan": return 'Car Loan'
    case "mortgage": return 'Mortgage'
    case "credit_card": return 'Credit Card'
    default: return 'Other'
  }
}

export function getAccountDisplay(accountType) {
  return {
    accountType,
    label: accountLabel(accountType),
    emoji: accountEmoji(accountType),
  }
}

export function getAccountDisplays() {
  return {
    assets: ACCOUNT_TYPES.filter(t => !isLiability(t)).map(getAccountDisplay),
    liabilities: ACCOUNT_TYPES.filter(t => isLiability(t)).map(getAccountDisplay),
    all: ACCOUNT_TYPES.map(getAccountDisplay),
  }
}

export function accountValue(account) {
  return realValue({ value: account.value, liability: isLiability(account.account_type) })
}

export function realValue({ value, liability }) {
  const factor = liability && (value > 0) ? -1 : +1
  return (value * factor)
}

export function ascHistory(history) {
  return history.toSorted((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}
export function descHistory(history) {
  return history.toSorted((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

const PERIODS = ['1d', '1m', '3m', 'ytd', 'all']

export function delta(a, b) {
  return {
    value: a - b,
    percentage: (a - b) / b,
  }
}

// Example: 1M
const account1 = [
  { date: '2023-01-01', value: 100 },
  { date: '2023-01-02', value: 150 },
  { date: '2023-01-03', value: 200 }
]

const successfulMonth = {
  value: 200 - 100, // +100
  percentage: (200 - 100) / 100 // +100%
}

// Example: 1M with only one data point for that month
const account2 = [
  { date: '2023-12-30', value: 100 },
  { date: '2023-12-31', value: 150 }, // we get the latest available from previous period
  { date: '2023-01-03', value: 200 }
]

const incompleteMonth = {
  value: 200 - 150, // +50
  percentage: (200 - 150) / 150 // +33.333%
}

// Example: 1M aggregated
const account3 = [
  { date: '2023-01-01', value: 100 },
  { date: '2023-01-02', value: 150 },
  { date: '2023-01-03', value: 400 }
]
const account4 = [
  { date: '2023-12-30', value: 100 },
  { date: '2023-12-31', value: 150 }, 
  { date: '2023-01-03', value: 200 }
]

// Given delta(a, b)
// Calculate `a`:
// const a = endPeriod(account3) + endPeriod(account4) // 600
// Calculate `b`:
// const b = startPeriod(account3) + startPeriod(account4) // 100 + 150 = 250

const aggregate = {
  value: 600 - 250,
  percentage: (600 - 250) / 250
}

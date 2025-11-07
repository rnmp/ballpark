# Cloud Syncing

Random thoughts on building a simple cloud syncing system using anonymous bin ids. Fits the use case as it requires no sign ups and the data being protected is not identifiable to the user so it's safe for this simple app. Probably one of the few places where this makes sense.

- No configuration required
- Must use a cloudLocation which is a unique identifier that must be treated like a password
- When app initializes (or gains focus) it will first load from localStorage
- It will then initialize cloud 
- If cloud is successfully retrieved we will then compare which was changed last (cloud vs. local)
    - The entire netWorth object is considered for last write wins
    - If cloud wins, we compare data, then override if necessary and refresh the page
    - If local wins, we update cloud but not refresh the page
- If cloud is unsuccessfully retrieved…
    - No connection: update UI to reflect offline state
    - If connection timeout: update UI to reflect offline state
    - If server error: update UI to reflect offline state
    - If not found or permission errors: prompt reconnection state

---

# Time Periods

Random thoughts on how to time periods empirically…

``` js
const PERIODS = ['1d', '1m', '3m', 'ytd', 'all']
```

### Example: 1M
``` js
const account1 = [
  { date: '2023-01-01', value: 100 },
  { date: '2023-01-02', value: 150 },
  { date: '2023-01-03', value: 200 }
]

const completeMonthData = {
  value: 200 - 100, // +100
  percentage: (200 - 100) / 100 // +100%
}
```

### Example: 1M with only one data point for that month
``` js
const account2 = [
  { date: '2023-12-30', value: 100 },
  { date: '2023-12-31', value: 150 }, // we get the latest available from previous period
  { date: '2023-01-03', value: 200 }
]

const incompleteMonth = {
  value: 200 - 150, // +50
  percentage: (200 - 150) / 150 // +33.333%
}
```

### Example: 1M aggregated
``` js
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
// const a = periodEnd(account3) + periodEnd(account4) // 600
// Calculate `b`:
// const b = periodStart(account3) + periodStart(account4) // 100 + 150 = 250

// `periodStart` will look at the earliest available data point in current period.
// Assumes datapoints are sorted in ascending order (by date)
//
// Fallback (in order):
// - Most immediately available (to the left)
// - Last available datapoint in current period (in practice, itself)
// - 0

// `periodEnd` will look at the latest available data point in current period.
// Assumes datapoints are sorted in ascending order (by date)
//
// Fallback (in order):
// - Last available datapoint in current period (in practice, itself)
// - Most immediately available (to the left)
// - 0

const aggregate = {
  value: 600 - 250,
  percentage: (600 - 250) / 250
}
```

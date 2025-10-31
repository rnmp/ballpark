import INITIAL_DATA from './initial-data.json' with { type: 'json' }

const initialData = INITIAL_DATA
initialData.accounts = initialData.accounts.map(a => ({ ...a, id: crypto.randomUUID(), history: [produceHistory(a.value)] }))

let netWorthData = initialData
try {
  const parsedNetWorthData = JSON.parse(localStorage.getItem('netWorth'))
  if (parsedNetWorthData) {
    netWorthData = parsedNetWorthData
  }
} catch(e) {
}
Object.freeze(netWorthData)

export function getSnapshot() {
  return JSON.parse(JSON.stringify(netWorthData))
}

export function getCurrency() {
  return netWorthData.currency || 'USD'
}

let undos = []
let redos = []

export function getHistoryCounts() {
  return { undos: undos.length, redos: redos.length }
}

export function commit(newData, opts = {}) {
  if (!newData || newData === netWorthData) {
    // Need to enforce in order to support history
    throw 'nope'
  }

  if (opts.undoing) {
    redos.push(netWorthData)
  } else {
    undos.push(netWorthData)
    redos = []
  }

  localStorage.setItem("netWorth", JSON.stringify(newData))
  netWorthData = newData
  Object.freeze(netWorthData)

}

export function resetData() {
  commit(initialData)
}

export function produceHistory(value) {
  return {
    timestamp: new Date().toISOString(),
    value,
  }
}

export function createAccount({ name, accountType, balance }) {
  const snapshot = getSnapshot()
  snapshot.accounts.push({ 
    id: crypto.randomUUID(), 
    name, 
    account_type: accountType, 
    value: balance, 
    history: [produceHistory(balance)],
  })
  commit(snapshot)
}

export function updateBalance({ balance, accountId }) {
  const snapshot = getSnapshot()
  const snapshotAccount = snapshot.accounts.find(a => a.id === accountId)
  snapshotAccount.value = balance
  snapshotAccount.history.push(produceHistory(balance))

  commit(snapshot)
}

export function undo() {
  const snapshot = undos.pop()
  commit(snapshot, { undoing: true })
}

export function redo() {
  const snapshot = redos.pop()
  commit(snapshot)
}

export function empty() {
  const snapshot = getSnapshot()
  snapshot.accounts = snapshot.accounts.map(a => ({
    ...a,
    value: 0,
    history: []
  }))
  commit(snapshot)
}

export function resetOnboarding() {
  localStorage.removeItem('onboarded')
}

export function finishOnboarding() {
  localStorage.setItem('onboarded', 'true')
}

export function isOnboarded() {
  return Boolean(localStorage.getItem('onboarded'))
}

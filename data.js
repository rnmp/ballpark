import INITIAL_DATA from './initial-data.json' with { type: 'json' }

const initialData = INITIAL_DATA
initialData.accounts = initialData.accounts.map(a => ({ ...a, id: crypto.randomUUID(), updatedAt: new Date().toISOString(), history: a.history.length ? a.history : [produceHistory(a.value)] }))

let netWorthData = initialData
try {
  const parsedNetWorthData = JSON.parse(localStorage.getItem('netWorth'))
  if (parsedNetWorthData) {
    netWorthData = parsedNetWorthData
  }
} catch (e) {
}

export function getSnapshot() {
  return JSON.parse(JSON.stringify(netWorthData))
}

export function getAccount(id) {
  return getSnapshot().accounts.find(a => a.id == id)
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
  if (newData !== netWorthData) {
    if (opts.undoing) {
      redos.push(netWorthData)
    } else {
      undos.push(netWorthData)
      redos = []
    }
  }

  if (!opts.cloudOverride) {
    newData.updatedAt = new Date().toISOString()
  }

  localStorage.setItem("netWorth", JSON.stringify(newData))
  netWorthData = newData

  if (opts.cloudOverride) {
    document.dispatchEvent(new CustomEvent('cloud-override'))
  } else {
    document.dispatchEvent(new CustomEvent('data-committed'))
  }
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

  return snapshotAccount
}

export function replaceBalance({ timestamp, balance, accountId }) {
  const snapshot = getSnapshot()
  const snapshotAccount = snapshot.accounts.find(a => a.id === accountId)
  snapshotAccount.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const historyIndex = snapshotAccount.history.findIndex(h => h.timestamp === timestamp)
  if (!snapshotAccount.history.at(historyIndex)) {
    throw 'Invalid history entry'
  }

  snapshotAccount.history[historyIndex] = {
    value: balance,
    timestamp,
  }

  const updatingLastHistory = historyIndex === 0
  if (updatingLastHistory) {
    snapshotAccount.value = balance
  }

  commit(snapshot)

  return snapshotAccount
}

export function deleteBalance({ timestamp, accountId }) {
  const snapshot = getSnapshot()
  const snapshotAccount = snapshot.accounts.find(a => a.id === accountId)
  if (snapshotAccount.history.length === 1) {
    // Do nothing, should always have one present
    return snapshotAccount
  }

  snapshotAccount.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const historyIndex = snapshotAccount.history.findIndex(h => h.timestamp === timestamp)
  if (!snapshotAccount.history.at(historyIndex)) {
    throw 'Invalid history entry'
  }

  const updatingLastHistory = historyIndex === 0
  const prevHistory = snapshotAccount.history.at(historyIndex + 1)

  if (updatingLastHistory && prevHistory) {
    snapshotAccount.value = prevHistory.value
  }

  snapshotAccount.history = snapshotAccount.history.filter(h => h.timestamp !== timestamp)

  commit(snapshot)

  return snapshotAccount
}

export function undo() {
  if (undos.length === 0) {
    return
  }
  const snapshot = undos.pop()
  commit(snapshot, { undoing: true })
}

export function redo() {
  if (redos.length === 0) {
    return
  }
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

window.getSnapshot = getSnapshot

export function resetOnboarding() {
  localStorage.removeItem('onboarded')
}

export function finishOnboarding() {
  localStorage.setItem('onboarded', 'true')
}

export function isOnboarded() {
  return Boolean(localStorage.getItem('onboarded'))
}

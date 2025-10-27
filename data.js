import INITIAL_DATA from './initial-data.json' with { type: 'json' }

const initialData = INITIAL_DATA
initialData.accounts = initialData.accounts.map(a => ({ ...a, id: crypto.randomUUID() }))

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

export function undo() {
  const snapshot = undos.pop()
  commit(snapshot, { undoing: true })
}

export function redo() {
  const snapshot = redos.pop()
  commit(snapshot)
}

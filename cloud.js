import { getSnapshot, commit } from './data.js'

// Don't get smart! Using this key doesn't give you anything other than unsafe
// JSON storage. If people abuse it I'll have to change it or move this 
// somewhere else, but I really would rather not, so be nice :)
const X_ACCESS_KEY = '$2a$10$vvwDEivzhzTYcDp1dwhFYubYpEztT1Jr0dl8yL5neHy.m0KjvAqr2'

async function deleteCloudState(cloudLocation) {
  const binId = cloudLocation
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'DELETE',
    headers: { 'X-Access-Key': X_ACCESS_KEY },
  })

  if (response.ok) {
    return { error: false, success: true }
  }

  return { error: true, success: false }
}


async function getCloudState(cloudLocation) {
  const binId = cloudLocation
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    headers: { 'X-Access-Key': X_ACCESS_KEY },
  })

  if (!response.ok) {
    return { error: true, data: undefined }
  }

  try {
    const json = await response.json()

    return {
      error: false,
      data: json,
    }
  } catch (_) {
    return { error: true, data: undefined }
  }
}

async function updateCloudState(cloudLocation, json) {
  const binId = cloudLocation
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Key': X_ACCESS_KEY
    },
    body: JSON.stringify(json),
  })

  if (response.ok) {
    return { error: false, success: true }
  }

  return { error: true, success: false }
}

async function createCloudState(json) {
  const response = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Key': X_ACCESS_KEY
    },
    body: JSON.stringify(json),
  })

  if (!response.ok) {
    return { error: true, data: undefined }
  }

  try {
    const json = await response.json()

    return {
      error: false,
      data: json,
    }
  } catch (_) {
    return { error: true, data: undefined }
  }
}

function getCloudLocation() {
  return localStorage.getItem('cloudLocation')
}

function setCloudLocation(cloudLocation) {
  return localStorage.setItem('cloudLocation', cloudLocation)
}

function deleteCloudLocation() {
  return localStorage.removeItem('cloudLocation')
}

function setCloudStatus(status) {
  $('#cloud_status').textContent = status
}

window.updateCloudState = (data) => updateCloudState(getCloudLocation(), data)
window.createCloudState = (data) => createCloudState(data)
window.getCloudState = () => getCloudState(getCloudLocation())

function setupConfigurationUI(cloudLocation) {
  const instructions = $('#cloud_instructions')
  const actions = $('#cloud_actions')
  actions.innerHTML = ''

  const feedback = $('#cloud_feedback')
  feedback.textContent = ''
  feedback.className = ''

  if (cloudLocation) {
    instructions.textContent = "Save the code below somewhere safe. You can use it to setup cloud sync on Ballpark in other devices. Don't share it with anyone!"
    const codeButton = make('button')
    codeButton.className = 'button'
    codeButton.textContent = cloudLocation
    let timeout = undefined
    codeButton.onclick = async () => {
      navigator.clipboard.writeText(cloudLocation)

      clearTimeout(timeout)
      codeButton.textContent = 'Copied to clipboard'
      timeout = setTimeout(() => {
        codeButton.textContent = cloudLocation
      }, 2000)
    }
    actions.append(codeButton)

    const deleteButton = make('button')
    deleteButton.className = 'button'
    deleteButton.textContent = 'Delete'
    deleteButton.onclick = async () => {
      await deleteCloudState(cloudLocation)
      deleteCloudLocation()
      setupConfigurationUI()
    }
    actions.append(deleteButton)

    feedback.textContent = 'Deleting this code will not erase your local data. Use the reset button below for that.'
    feedback.className = 'font-sm mt-4'

    return
  }

  instructions.textContent = 'Sync across your devices — no sign up needed! Your data will be anonymously saved to the cloud and can be deleted any time.'

  const getStarted = make('button')
  getStarted.className = 'button button-primary'
  getStarted.textContent = 'Get Started'
  getStarted.onclick = async () => {
    getStarted.textContent = 'Loading…'
    const { data } = await createCloudState(getSnapshot())
    const newCloudLocation = data.metadata.id
    setCloudLocation(newCloudLocation)
    setupConfigurationUI(newCloudLocation)
  }
  actions.append(getStarted)

  const restore = make('button')
  restore.className = 'button'
  restore.textContent = 'Restore'
  restore.onclick = async () => {
    const existingCloudLocation = prompt('Enter your cloud code')
    if (!existingCloudLocation) {
      return
    }
    const { error, data } = await getCloudState(existingCloudLocation)
    if (error) {
      feedback.textContent = 'Are you sure this an existing code? Try again.'
      feedback.className = 'font-sm mt-4'
      return
    }
    if (data) {
      const cloudSnapshot = data.record
      commit(cloudSnapshot, { cloudOverride: true })
      setCloudLocation(existingCloudLocation)
      setupConfigurationUI(existingCloudLocation)
    }
  }
  actions.append(restore)
}

export function initializeCloud() {
  let syncTimeout
  document.addEventListener('data-committed', () => {
    clearTimeout(syncTimeout)
    syncTimeout = setTimeout(async () => {
      const cloudLocation = getCloudLocation()
      if (!cloudLocation) {
        return
      }
      setCloudStatus('Syncing…')
      const { success } = await updateCloudState(cloudLocation, getSnapshot())
      if (success) {
        setCloudStatus('')
      } else {
        setCloudStatus('Whoops…')
      }
    }, 500)
  })

  const cloudLocation = getCloudLocation()
  setupConfigurationUI(cloudLocation)

  let checkedCloudStatusAt = undefined

  async function checkCloudStatus(opts = {}) {
    if (!cloudLocation || !opts.force && checkedCloudStatusAt && checkedCloudStatusAt.getTime() > new Date().getTime() - 60_000) {
      return
    }

    checkedCloudStatusAt = new Date()

    setCloudStatus('Syncing…')
    const { error, data } = await getCloudState(cloudLocation)
    if (error) {
      setCloudStatus('Whoops…')
      return
    }

    const localSnapshot = getSnapshot()
    const localUpdatedAt = new Date(localSnapshot.updatedAt)
    const cloudSnapshot = data.record
    const cloudUpdatedAt = new Date(cloudSnapshot.updatedAt)

    if (cloudUpdatedAt.getTime() === localUpdatedAt.getTime()) {
      setCloudStatus('No changes detected')
      await sleep(1000)
      setCloudStatus('')
      return
    }

    if (cloudUpdatedAt > localUpdatedAt) {
      commit(cloudSnapshot, { cloudOverride: true })
      setCloudStatus('Updated local data')
      await sleep(1000)
      setCloudStatus('')
      return
    }

    const { success } = await updateCloudState(cloudLocation, localSnapshot)
    if (success) {
      setCloudStatus('Updated cloud data')
      await sleep(1000)
      setCloudStatus('')
    } else {
      setCloudStatus('Whoops…')
    }
  }

  $('#cloud_status').onclick = () => {
    checkCloudStatus({ force: true })
  }

  checkCloudStatus()

  window.addEventListener("focus", () => {
    checkCloudStatus()
  })
}

import { accountEmoji, accountValue, getAccountDisplay, getAccountDisplays, isLiability } from './accounts.js'
import { money, sanitizeMoneyInput } from './money.js'
import { commit, createAccount, updateBalance, getSnapshot, undo, redo, getHistoryCounts, resetData, getAccount, empty, isOnboarded, finishOnboarding, resetOnboarding } from './data.js'
import { editableText, deltaToggle, dotChart } from './components.js'
import { delta } from './timeseries.js'
import { renderAccountHistory } from './accountHistory.js'
import { initializeCloud } from './cloud.js'

const settingsModal = $('#settings')
const newAccountForm = $('#new_account_form')
const welcomeMessage = $('#welcome_message')
const editAccount = $('#edit_account')

const PERMANENT_MODALS = new Set([
  settingsModal,
  newAccountForm,
  welcomeMessage,
  editAccount
])

const modalOverlay = $('#modal_overlay')
let activeModal = undefined;

let activeAccount = undefined;
let activeIcon = undefined;

const accountRows = new Map()
const accountsList = $('#accounts')

let dragSession = {}
let customOrderEnabled = false

$('#undo').addEventListener('click', () => {
  undo()
  renderEverything()
})

$('#redo').addEventListener('click', () => {
  redo()
  renderEverything()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeModal && !(e.target instanceof HTMLInputElement)) {
    closeActiveModal()
    return
  }
  if (e.metaKey && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
    renderEverything()
  }
})

$('#new_account').addEventListener('click', () => {
  newAccountForm.querySelector('input[name="initial_value"]').setAttribute('placeholder', money(30000))
  newAccountForm.querySelector('input[value="savings"]').checked = true
  presentModal(newAccountForm)
  newAccountForm.querySelector('input[name="name"]').focus()
})

function populateAccountEmojiSelector() {
  const emojiOptions = $('#account_emoji_selector')
  const emojis = [
    'none', '🏛️', '🏁', '🌧️', '🐷', '🫆', '💸', '✨', '⚡️',
    '❤️', '✅', '🖼️', '🖥️', '🚗', '🏥', '🍼', '🗄️', '💥',
    '😎', '🤩', '🤓', '😍', '😭', '🥳', '🤖', '😈', '👿'
  ]

  for (const emoji of emojis) {
    const optionId = `account_emoji:${emoji}`
    const optionLabel = make('label')
    optionLabel.className = 'select-option button p-0 flex items-center justify-center'
    optionLabel.htmlFor = optionId

    const text = make('span')
    text.textContent = emoji
    optionLabel.append(text)

    const option = make('input')
    option.id = optionId
    option.setAttribute('type', 'radio')
    option.setAttribute('name', 'account_emoji')
    option.value = emoji
    option.onclick = () => {
      if (!activeAccount) {
        return
      }

      const snapshot = getSnapshot()
      const account = snapshot.accounts.find(a => a.id === activeAccount.id)
      account.icon = emoji === 'none' ? undefined : emoji
      commit(snapshot)

      const { emoji: defaultEmoji } = getAccountDisplay(account.account_type)
      if (activeIcon) {
        activeIcon.textContent = emoji === 'none' ? defaultEmoji : emoji
      }
    }
    optionLabel.append(option)

    emojiOptions.append(optionLabel)
  }
}

function populateAccountTypeSelector() {
  const { assets, liabilities } = getAccountDisplays()

  const assetOptions = $('#asset_options')
  for (const assetType of assets) {
    assetOptions.append(makeOption(assetType))
  }

  const liabilityOptions = $('#liability_options')
  for (const liabilityType of liabilities) {
    liabilityOptions.append(makeOption(liabilityType))
  }

  function makeOption({ accountType, label, emoji }) {
    const optionId = `account_type:${accountType}`
    const optionLabel = make('label')
    optionLabel.className = 'select-option button font-sm'
    optionLabel.htmlFor = optionId
    optionLabel.textContent = `${emoji} ${label}`

    const option = make('input')
    option.id = optionId
    option.setAttribute('type', 'radio')
    option.setAttribute('name', 'account_type')
    option.value = accountType
    optionLabel.append(option)

    return optionLabel
  }
}

$('#settings_button').addEventListener('click', () => {
  // Set currency selector to current value
  const snapshot = getSnapshot()
  $('#currency_selector').value = snapshot.currency || 'USD'

  // Show/hide reset ordering button based on whether custom ordering is enabled
  const orderingSection = $('#account_ordering_section')
  if (snapshot.customOrderEnabled) {
    orderingSection.style.display = 'block'
  } else {
    orderingSection.style.display = 'none'
  }

  presentModal(settingsModal)
})

$('#currency_selector').addEventListener('change', (e) => {
  const snapshot = getSnapshot()
  snapshot.currency = e.target.value
  commit(snapshot)
  renderEverything()
})

$('#import_data').addEventListener('click', () => {
  $('#import_data_file_picker').click()
})

function validateImport(jsonString) {
  // TODO: implement me
  return JSON.parse(jsonString)
}

$('#import_data_file_picker').addEventListener('change', async () => {
  const selectedFile = $('#import_data_file_picker').files[0]
  if (!selectedFile) {
    alert('Something went wrong!!!!')
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const validatedImport = validateImport(e.target.result)
    if (validatedImport) {
      commit(validatedImport)
      renderEverything()
    }
  }
  reader.readAsText(selectedFile)
})

$('#export_data').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(getSnapshot(), null, 2)]);
  const link = document.createElement("a");
  link.download = 'download.json';
  link.href = window.URL.createObjectURL(blob);
  link.click()
})

$('#reset_data_button').addEventListener('click', () => {
  resetData()
  resetOnboarding()
  renderEverything()
  activeModal.classList.remove('shown')
  welcomeUser()
})

$('#reset_ordering_button').addEventListener('click', () => {
  const snapshot = getSnapshot()

  // Remove custom ordering
  snapshot.customOrderEnabled = false
  snapshot.accounts.forEach(account => {
    delete account.order
  })

  commit(snapshot)
  renderEverything()

  // Hide the ordering section after reset
  $('#account_ordering_section').style.display = 'none'

  // Show feedback
  const button = $('#reset_ordering_button')
  const originalText = button.textContent
  button.textContent = 'Reset Successful!'
  setTimeout(() => {
    button.textContent = originalText
  }, 2000)
})

newAccountForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const form = e.target
  const data = new FormData(form)

  createAccount({
    name: data.get("name") || "Account",
    accountType: data.get("account_type"),
    balance: sanitizeMoneyInput(data.get("initial_value"))
  })

  closeActiveModal()
  renderEverything()
  form.reset()
})

function closeActiveModal() {
  $('main').classList.remove('suspended')
  activeModal.classList.remove('shown')
  modalOverlay.classList.remove('shown')
  if (activeModal === welcomeMessage) {
    finishOnboarding()
  }

  if (!PERMANENT_MODALS.has(activeModal)) {
    document.body.removeChild(activeModal)
  }

  activeModal = undefined
}

modalOverlay.addEventListener('click', () => {
  closeActiveModal()
})

function renderTotal() {
  const total = getSnapshot()
    .accounts
    .reduce((total, account) => total + accountValue(account), 0)
  transitionFigure($('#total'), money(total))
}

const cancellables = new Map()

function transitionFigure(node, newFigure) {
  const cancellable = cancellables.get(node)
  if (cancellable) {
    cancellable()
  }

  node.style.position = 'relative'
  const currentNumber = node.textContent.toString()
  node.innerHTML = ''

  const transitionContainer = document.createElement('span')
  node.append(transitionContainer)

  const targetNumber = newFigure
  const transitionDoppleganger = document.createElement('span')
  transitionDoppleganger.style.position = 'absolute'
  transitionDoppleganger.style.left = '0'
  node.append(transitionDoppleganger)

  const speed = targetNumber.length > 0 ? Math.max(10, Math.round(300 / targetNumber.length)) : 60

  const timeouts = []

  for (let i = 0; i < currentNumber.length; i++) {
    const subNumber = document.createElement('span')
    subNumber.style.display = 'inline-block'
    subNumber.style.transition = 'all 0.2s ease-in-out'
    const char = currentNumber[i]
    subNumber.textContent = char
    transitionContainer.append(subNumber)

    const timeout = setTimeout(() => {
      subNumber.style.transform = 'translateY(-50%) scale(0.2)'
      subNumber.style.opacity = 0
    }, speed * i + 1)
    timeouts.push(timeout)
  }

  for (let i = 0; i < targetNumber.length; i++) {
    const subNumber = document.createElement('span')
    subNumber.style.display = 'inline-block'
    subNumber.style.transition = 'all 0.2s ease-in-out'
    subNumber.style.transform = 'translateY(50%) scale(0.2)'
    subNumber.style.opacity = 0
    const char = targetNumber[i]
    subNumber.textContent = char
    transitionDoppleganger.append(subNumber)

    const timeout = setTimeout(() => {
      subNumber.style.transform = 'translateY(0%) scale(1.0)'
      subNumber.style.opacity = 1
    }, speed * i + 1)
    timeouts.push(timeout)
  }


  const timeout = setTimeout(() => {
    node.textContent = newFigure
    cancellables.delete(node)
  }, Math.max(targetNumber.length, currentNumber.length) * speed + 200)
  timeouts.push(timeout)

  cancellables.set(
    node,
    () => {
      for (let ti = 0; ti < timeouts.length; ti++) {
        clearTimeout(timeouts[ti])
      }
      node.textContent = newFigure
      cancellables.delete(node)
    }
  )
}

function renderToolbar() {
  const { undos, redos } = getHistoryCounts()

  $('#undo').disabled = !Boolean(undos)
  $('#redo').disabled = !Boolean(redos)
}

function renderEverything() {
  renderTotal()
  renderAccounts()
  renderToolbar()
}


// Drag and drop handlers (adapted from Coleure)
function handleDragStart(e) {
  e.dataTransfer.effectAllowed = 'move'
  const draggingElement = e.currentTarget
  draggingElement.style.opacity = '0.3'

  const parent = Array.from(accountsList.children)
  const draggingIndex = parent.indexOf(draggingElement)

  // Capture regions before any transforms
  dragSession.regions = parent.map((el, i) => ({
    index: i,
    rect: el.getBoundingClientRect(),
    element: el
  }))
  dragSession.draggingElement = draggingElement
  dragSession.draggingIndex = draggingIndex
  dragSession.insertionIndex = draggingIndex

  e.dataTransfer.setData('text', draggingIndex)
}

function handleDragOver(e) {
  e.preventDefault()
  if (!dragSession.regions) return

  // Find insertion index based on mouse Y position
  let newInsertionIndex = dragSession.regions.length
  for (let i = 0; i < dragSession.regions.length; i++) {
    const region = dragSession.regions[i]
    const midpoint = region.rect.top + region.rect.height / 2
    if (e.clientY < midpoint) {
      newInsertionIndex = i
      break
    }
  }

  // Only recalculate if insertion point changed
  if (newInsertionIndex === dragSession.insertionIndex) return
  dragSession.insertionIndex = newInsertionIndex

  // Recalculate all transforms
  dragSession.regions.forEach(({ index, element, rect }) => {
    if (index === dragSession.draggingIndex) return

    const shiftAmount = rect.height
    let shouldShift = false

    if (dragSession.draggingIndex < dragSession.insertionIndex) {
      // Dragging downward: shift elements between original and insertion up
      shouldShift = index > dragSession.draggingIndex && index < dragSession.insertionIndex
    } else {
      // Dragging upward: shift elements between insertion and original down
      shouldShift = index < dragSession.draggingIndex && index >= dragSession.insertionIndex
    }

    element.style.transform = shouldShift
      ? `translateY(${dragSession.draggingIndex < dragSession.insertionIndex ? -shiftAmount : shiftAmount}px)`
      : ''
  })

  return false
}

function handleDrop(e) {
  e.preventDefault()

  // Reorder if insertion point changed
  if (dragSession.insertionIndex !== undefined && dragSession.insertionIndex !== dragSession.draggingIndex) {
    const snapshot = getSnapshot()

    // Enable custom ordering
    snapshot.customOrderEnabled = true

    // Assign order values if not already present
    if (!snapshot.accounts.some(a => a.order !== undefined)) {
      // Get accounts in current visual order
      const visualOrder = Array.from(accountsList.children).map(el => el.dataset.accountId)
      visualOrder.forEach((id, index) => {
        const account = snapshot.accounts.find(a => a.id === id)
        if (account) account.order = index
      })
    }

    // Get account being moved
    const draggedAccountId = dragSession.draggingElement.dataset.accountId
    const draggedAccount = snapshot.accounts.find(a => a.id === draggedAccountId)

    // Calculate new order values
    const visualOrder = Array.from(accountsList.children).map(el => el.dataset.accountId)
    const [movedId] = visualOrder.splice(dragSession.draggingIndex, 1)

    // Insert at new position
    const adjustedIndex = dragSession.insertionIndex > dragSession.draggingIndex
      ? dragSession.insertionIndex - 1
      : dragSession.insertionIndex
    visualOrder.splice(adjustedIndex, 0, movedId)

    // Update order values
    visualOrder.forEach((id, index) => {
      const account = snapshot.accounts.find(a => a.id === id)
      if (account) account.order = index
    })

    // Sort accounts by new order
    snapshot.accounts.sort((a, b) => (a.order || 0) - (b.order || 0))

    commit(snapshot)

    // Reset all transforms
    if (dragSession.regions) {
      dragSession.regions.forEach(({ element }) => {
        element.style.transition = 'none'
        element.style.transform = ''
      })
    }

    // Rearrange DOM elements
    const children = Array.from(accountsList.children)
    if (adjustedIndex >= children.length) {
      accountsList.appendChild(dragSession.draggingElement)
    } else {
      if (dragSession.insertionIndex > dragSession.draggingIndex) {
        children[adjustedIndex].after(dragSession.draggingElement)
      } else {
        children[adjustedIndex].before(dragSession.draggingElement)
      }
    }
  }

  return false
}

function handleDragEnd(e) {
  e.preventDefault()
  if (dragSession.regions) {
    dragSession.regions.forEach(({ element }) => {
      element.style.transform = ''
      element.style.removeProperty('transition')
    })
  }

  if (dragSession.draggingElement) {
    dragSession.draggingElement.style.opacity = '1'
  }
  dragSession = {}
}

function handleDragEnter(e) {
  e.preventDefault()
}

function handleDragLeave(e) {
  e.preventDefault()
}

$('#delete_account_button').addEventListener('click', async () => {
  if (!activeAccount) {
    return
  }

  closeActiveModal()

  const accountRow = accountRows.get(activeAccount.id)
  accountRow.style.opacity = 0.0
  accountRow.style.height = '0px'

  await sleep(200)

  accountsList.removeChild(accountRow)
  accountRows.delete(activeAccount.id)

  const snapshot = getSnapshot()
  snapshot.accounts = snapshot.accounts.filter(a => a.id !== activeAccount.id)
  commit(snapshot)

  renderTotal()
  renderToolbar()
})

function renderAccount(account) {
  const wrapper = make('div')
  wrapper.className = 'account-row flex gap-3 items-center pl-6 border-t-0.5 transition-all h-18'
  wrapper.style.position = 'relative'
  wrapper.draggable = true
  wrapper.dataset.accountId = account.id

  // Add drag handle (positioned absolutely in the left padding area)
  const dragHandle = make('div')
  dragHandle.className = 'drag-handle'
  dragHandle.innerHTML = '⋮⋮'
  wrapper.append(dragHandle)

  // Drag event listeners
  wrapper.addEventListener('dragstart', handleDragStart)
  wrapper.addEventListener('dragend', handleDragEnd)

  const icon = make('div')
  icon.className = 'button p-0 font-lg size-10 flex items-center justify-center rounded-full'
  icon.style.flexShrink = '0'
  icon.textContent = account.icon || accountEmoji(account.account_type)
  icon.onclick = () => {
    const snapshotAccount = getAccount(account.id)
    const type = editAccount.querySelector('[data-account-type]')
    const { emoji } = getAccountDisplay(snapshotAccount.account_type)
    type.textContent = `${emoji} ${isLiability(snapshotAccount.account_type) ? 'Liability' : 'Asset'}`
    const name = editAccount.querySelector('[data-account-name]')
    name.textContent = snapshotAccount.name

    activeAccount = snapshotAccount
    activeIcon = icon

    const currentIconName = snapshotAccount.icon ? snapshotAccount.icon : 'none'
    editAccount.querySelector(`input[value='${currentIconName}'][name='account_emoji']`).checked = true
    editAccount.querySelector(`label[for='account_emoji:none'] > span`).textContent = emoji

    presentModal(editAccount)
  }

  wrapper.append(icon)

  const header = make('header')
  wrapper.append(header)

  const name = make('h1')
  name.className = 'font-semibold font-sm'
  header.append(name)

  editableText(
    name,
    account.name,
    (newName) => {
      const snapshot = getSnapshot()
      const snapshotAccount = snapshot.accounts.find(a => a.id === account.id)
      snapshotAccount.name = newName
      commit(snapshot)
      account.name = newName

      renderToolbar()
    },
    wrapper
  )

  const balance = make('h2')
  header.append(balance)

  editableText(
    balance,
    money(accountValue(account)),
    (newBalance) => {
      const nextValue = sanitizeMoneyInput(newBalance)

      let updatedAccount = undefined
      if (account.value !== nextValue) {
        updatedAccount = updateBalance({ balance: nextValue, accountId: account.id })
      }

      if (!updatedAccount) {
        return
      }

      document.dispatchEvent(new CustomEvent('account-balance-changed', {
        detail: { updatedAccount }
      }))
    },
    wrapper
  )

  const options = make('div')
  options.className = 'flex flex-1 justify-end items-end'
  wrapper.append(options)

  const orderedHistory = account.history.toSorted(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  )
  const historyValues = orderedHistory.map(h => h.value).slice(-30)
  const [b, a] = historyValues.slice(-2)
  const button = make('button')
  button.className = 'bounce font-sm mr-4'
  options.append(button)

  deltaToggle(
    button,
    a && b ? delta(a, b) : { value: accountValue(account), percentage: 1 }
  )

  const chart = dotChart(historyValues, { size: 2, maxCount: 30 })
  chart.className = chart.className.concat(' mr-6 bounce')
  chart.style.maxWidth = chart.style.width
  chart.style.width = ''
  chart.style.overflow = 'hidden'
  chart.style.flex = '1'

  chart.onclick = () => {
    const accountHistory = renderAccountHistory(account)
    presentModal(accountHistory)
  }
  options.append(chart)

  return wrapper
}

document.addEventListener('account-balance-changed', (e) => {
  const { updatedAccount } = e.detail
  const accountId = updatedAccount.id

  const accountRow = accountRows.get(accountId)
  const newAccountRow = renderAccount(updatedAccount)

  const snapshot = getSnapshot()

  // Only reorder if custom ordering is not enabled
  if (!snapshot.customOrderEnabled) {
    const sortedAccounts = snapshot.accounts
      .toSorted((a, b) => accountValue(b) - accountValue(a))
    const accountIndex = sortedAccounts.findIndex(a => a.id === accountId)
    const prevAccountId = sortedAccounts.at(accountIndex + 1)?.id
    const prevAccountRow = accountRows.get(prevAccountId)

    if (prevAccountRow) {
      accountsList.insertBefore(newAccountRow, prevAccountRow)
      accountsList.removeChild(accountRow)
    } else if (accountRow.nextSibling) {
      accountRow.nextSibling.after(newAccountRow)
      accountsList.removeChild(accountRow)
    } else {
      accountsList.replaceChild(newAccountRow, accountRow)
    }
  } else {
    // When custom ordering is enabled, just replace in place
    accountsList.replaceChild(newAccountRow, accountRow)
  }

  accountRows.set(accountId, newAccountRow)

  renderToolbar()
  renderTotal()
})

function renderAccounts() {
  const snapshot = getSnapshot()
  customOrderEnabled = snapshot.customOrderEnabled || false

  let sortedAccounts
  if (customOrderEnabled && snapshot.accounts.some(a => a.order !== undefined)) {
    // Use custom order if enabled
    sortedAccounts = snapshot.accounts.toSorted((a, b) => (a.order || 0) - (b.order || 0))
  } else {
    // Default sorting by value (highest first)
    sortedAccounts = snapshot.accounts.toSorted((a, b) => accountValue(b) - accountValue(a))
  }

  let accountUIs = []

  for (const account of sortedAccounts) {
    const accountUI = renderAccount(account)
    accountRows.set(account.id, accountUI)
    accountUIs.push(accountUI)
  }

  accountsList.innerHTML = ''
  accountsList.append(...accountUIs)
}

function presentModal(node) {
  modalOverlay.classList.add('shown')
  node.classList.add('shown')
  activeModal = node
  $('main').classList.add('suspended')
}

function welcomeUser() {
  if (isOnboarded()) {
    return
  }

  presentModal(welcomeMessage)
}

$('#start_fresh').addEventListener('click', () => {
  empty()
  renderEverything()
  closeActiveModal()
})

$('#demo_mode').addEventListener('click', () => {
  closeActiveModal()
})

document.addEventListener('cloud-override', () => {
  renderEverything()
})

const setThemeColor = () => {
  const color = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? '#000000' : '#ffffff'
  document.querySelector('meta[name="theme-color"]').content = color
}
setThemeColor()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setThemeColor)

function initialize() {
  welcomeUser()
  populateAccountTypeSelector()
  populateAccountEmojiSelector()
  renderEverything()
  initializeCloud()

  // Add drag event listeners to the accounts container
  accountsList.addEventListener('dragover', handleDragOver)
  accountsList.addEventListener('drop', handleDrop)
}
initialize()

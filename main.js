import { accountEmoji, accountValue, getAccountDisplay, getAccountDisplays, isLiability, realValue, ascHistory, descHistory } from './accounts.js'
import { money, sanitizeMoneyInput } from './money.js'
import { commit, createAccount, updateBalance, getSnapshot, undo, redo, getHistoryCounts, resetData, getAccount, empty, isOnboarded, finishOnboarding, resetOnboarding, replaceBalance, deleteBalance } from './data.js'
import { $, make } from './dom.js'
import { editableText, deltaToggle, dotChart, menu } from './components.js'
import { delta } from './timeseries.js'


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

$('#undo').addEventListener('click', () => {
  undo()
  renderEverything()
})

$('#redo').addEventListener('click', () => {
  redo()
  renderEverything()
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

newAccountForm.addEventListener('submit', (e) => {
  e.preventDefault();
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
  $('#total').textContent = money(total)
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



const sleep = (num) => new Promise(resolve => setTimeout(resolve, num))

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
  wrapper.className = 'flex gap-3 items-center pl-6 border-t-0.5 transition-all h-18'

  const icon = make('div')
  icon.className = 'button p-0 font-lg size-10 flex items-center justify-center rounded-full'
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
    }
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
    }
  )

  const options = make('div')
  options.className = 'flex flex-1 justify-end items-end'
  wrapper.append(options)

  const orderedHistory = account.history.toSorted(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  )
  const historyValues = orderedHistory.map(h => h.value).slice(-30)
  const [b, a] = historyValues.slice(-2)
  if (a && b) {
    const button = make('button')
    button.className = 'bounce font-sm mr-4'
    options.append(button)

    deltaToggle(button, delta(a, b))
  }

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

  const sortedAccounts = getSnapshot()
    .accounts
    .toSorted((a, b) => accountValue(b) - accountValue(a))
  const accountIndex = sortedAccounts.findIndex(a => a.id === accountId)
  const prevAccountId = sortedAccounts.at(accountIndex + 1)?.id
  const prevAccountRow = accountRows.get(prevAccountId)

  if (prevAccountRow) {
    accountsList.insertBefore(newAccountRow, prevAccountRow)
  } else {
    accountRow.nextSibling.after(newAccountRow)
  }
  accountsList.removeChild(accountRow)

  accountRows.set(accountId, newAccountRow)

  renderToolbar()
  renderTotal()
})

function renderAccountHistory(account) {
  const modal = make('div')
  modal.className = 'modal'
  document.body.append(modal)

  const chartContainer = make('div')
  chartContainer.className = 'px-4 py-4'
  modal.append(chartContainer)

  const ul = make('ul')
  ul.className = 'list-none border-t-0.5'
  ul.style.maxHeight = '300px'
  ul.style.overflow = 'scroll'
  modal.append(ul)

  const chartUlHandlers = {
    mouseOver: (barIndex) => {
      const item = ul.children[ul.children.length - 1 - barIndex]
      if (!item) {
        return
      }
      item.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" })
      item.style.background = 'color-mix(in srgb, var(--text-color) 10%, transparent)'
    },
    mouseOut: () => {
      for (const item of ul.children) {
        item.style.background = ''
      }
    }
  }

  function makeChart(history) {
    const historyValues = ascHistory(history).map(h => h.value).slice(-46)
    const chart = dotChart(historyValues, { size: 6, maxCount: 46 })
    chart.registerHandlers(chartUlHandlers)

    return chart
  }

  function populateDeltas(history) {
    if (history.length === 1) {
      const listItem = ul.children[0]
      if (!listItem) {
        return
      }
      listItem.deltaPlaceholder.innerHTML = ''
      return
    }
    for (let i = 0; i < history.length; i++) {
      const listItem = ul.children[i]
      if (!listItem) {
        continue
      }

      const historyItem = history.at(i)
      const prevHistoryItem = history.at(i + 1)
      if (!prevHistoryItem) {
        continue;
      }

      listItem.deltaPlaceholder.innerHTML = ''

      const changeDisplay = make('button')
      changeDisplay.className = 'bounce font-sm'
      deltaToggle(changeDisplay, delta(historyItem.value, prevHistoryItem.value))

      listItem.deltaPlaceholder.append(changeDisplay)
    }
  }

  let chart = makeChart(account.history)
  chartContainer.append(chart)

  const orderedHistory = descHistory(account.history)
  for (let i = 0; i < orderedHistory.length; i++) {
    const history = orderedHistory.at(i)
    const li = make('li')
    li.className = 'border-t-0.5 px-4 py-2 flex items-center justify-between'
    if (i === 0) {
      li.classList.remove('border-t-0.5')
    }

    const valueContainer = make('div')
    valueContainer.className = 'flex flex-column gap-1 flex-1'
    li.append(valueContainer)

    const time = make('time')
    time.className = 'font-sm font-semibold'
    time.datetime = history.timestamp
    time.textContent = history.timestamp.split('T')[0]
    valueContainer.append(time)

    function makeBalance({ value, liability }) {
      const balance = make('p')
      balance.style.marginLeft = '-4.5px'
      editableText(
        balance,
        money(realValue({ value, liability })),
        (newBalance) => {
          const nextValue = sanitizeMoneyInput(newBalance)

          let updatedAccount = undefined
          if (account.value !== nextValue) {
            updatedAccount = replaceBalance({ timestamp: history.timestamp, balance: nextValue, accountId: account.id })
          }

          if (!updatedAccount) {
            return
          }

          valueContainer.replaceChild(makeBalance({ value: nextValue, liability }), balance)

          let newChart = makeChart(updatedAccount.history)
          chartContainer.replaceChild(newChart, chart)
          chart = newChart

          populateDeltas(descHistory(updatedAccount.history))

          document.dispatchEvent(new CustomEvent('account-balance-changed', {
            detail: { updatedAccount }
          }))
        }
      )
      return balance
    }

    valueContainer.append(makeBalance({ value: history.value, liability: isLiability(account.account_type) }))

    const deltaPlaceholder = make('div')
    li.deltaPlaceholder = deltaPlaceholder
    li.append(deltaPlaceholder)

    const historyMenu = make('button')
    historyMenu.className = 'button ml-4'
    historyMenu.textContent = '…'
    li.historyMenu = historyMenu

    menu(historyMenu, [
      {
        label: 'Delete',
        action: () => {
          ul.removeChild(li)

          const updatedAccount = deleteBalance({ timestamp: history.timestamp, accountId: account.id })

          let newChart = makeChart(updatedAccount.history)
          chartContainer.replaceChild(newChart, chart)
          chart = newChart

          populateDeltas(descHistory(updatedAccount.history))

          document.dispatchEvent(new CustomEvent('account-balance-changed', {
            detail: { updatedAccount }
          }))

          if (updatedAccount.history.length === 1) {
            for (const child of ul.children) {
              child.removeChild(child.historyMenu)
            }
          }
        }
      }
    ])

    if (orderedHistory.length > 1) {
      li.append(historyMenu)
    }

    li.onmouseover = () => {
      chart.select(i)
      li.style.background = 'color-mix(in srgb, var(--text-color) 10%, transparent)'
    }

    li.onmouseout = () => {
      chart.deselect()
      for (const item of ul.children) {
        item.style.background = ''
      }
    }

    ul.append(li)
  }

  populateDeltas(orderedHistory)

  return modal
}


function renderAccounts() {
  const sortedAccounts = getSnapshot()
    .accounts
    .toSorted((a, b) => accountValue(b) - accountValue(a))
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

function initialize() {
  welcomeUser()
  populateAccountTypeSelector()
  populateAccountEmojiSelector()
  renderEverything()
}
initialize()

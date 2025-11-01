import { accountEmoji, accountValue, getAccountDisplay, getAccountDisplays, isLiability } from './accounts.js'
import { money, sanitizeMoneyInput } from './money.js'
import { commit, createAccount, updateBalance, getSnapshot, undo, redo, getHistoryCounts, resetData, getAccount, empty, isOnboarded, finishOnboarding, resetOnboarding } from './data.js'
import { $, make } from './dom.js'
import { editableText, deltaToggle, dotChart } from './components.js'
import { delta } from './timeseries.js'

const modalOverlay = $('#modal_overlay')
const newAccountForm = $('#new_account_form')
const welcomeMessage = $('#welcome_message')
let activeModal = undefined;
let activeAccount = undefined;
let activeIcon = undefined;

$('#undo').addEventListener('click', () => {
  undo()
  renderEverything()
})

$('#redo').addEventListener('click', () => {
  redo()
  renderEverything()
})

$('#new_account').addEventListener('click',  () => {
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

  function makeOption ({ accountType, label, emoji }) {
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

  const settings = $('#settings')
  presentModal(settings)
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

$('#import_data_file_picker').addEventListener('change', async (event) => {
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


  $('#delete_account_button').addEventListener('click', () => {
    if (!activeAccount) {
      return
    }

    const snapshot = getSnapshot()
    snapshot.accounts = snapshot.accounts.filter(a => a.id !== activeAccount.id)
    commit(snapshot)

    renderEverything()

    closeActiveModal()
  })

function renderAccount(account) {
  const wrapper = make('div')
  wrapper.className = 'flex gap-3 items-center pl-6 border-t-0.5'

  const icon = make('div')
  icon.className = 'button p-0 font-lg size-10 flex items-center justify-center rounded-full'
  icon.textContent = account.icon || accountEmoji(account.account_type)
  icon.onclick = () => {
    const snapshotAccount = getAccount(account.id)
    const editAccount = $('#edit_account')
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
  header.className = 'py-3'
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

      // We don't need to render everything
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
      if (account.value !== nextValue) {
        updateBalance({ balance: nextValue, accountId: account.id })
      }

      // TODO: should only need to re-render total but
      // right now the formatting is not being applied
      renderEverything()
    }
  )

  const options = make('div')
  options.className = 'flex flex-1 justify-end items-end'
  wrapper.append(options)

  const historyValues = account.history.map(h => h.value).slice(-30)
  const [b, a] = historyValues.slice(-2)
  if (a && b) {
    const button = make('button')
    button.className = 'bounce font-sm mr-4'
    options.append(button)

    deltaToggle(button, delta(a, b))
  }

  const chart = dotChart(historyValues, { size: 2, maxCount: 30 })
  chart.className = chart.className.concat(' mr-6 bounce')
  chart.onclick = () => {
    const accountHistory = renderAccountHistory(account)
    presentModal(accountHistory)
  }
  options.append(chart)

  return wrapper
}

function renderAccountHistory(account) {
  const modal = make('div')
  modal.className = 'modal'
  document.body.append(modal)

  const historyValues = account.history.map(h => h.value).slice(-43)
  const chart = dotChart(historyValues, { size: 6, maxCount: 43 })
  modal.append(chart)

  const ul = make('ul')
  modal.append(ul)

  const orderedHistory = account.history.toSorted(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  )
  for (let i = 0; i < orderedHistory.length; i++) {
    const history = orderedHistory.at(i)
    const prevHistory = orderedHistory.at(i + 1)
    let content = money(history.value)
    if (prevHistory) {
      const deltaz = delta(history.value, prevHistory.value)
      content = content + ` ${money(deltaz.value)}`
    }
    const li = make('li')
    li.textContent = content
    ul.append(li)
  }

  return modal
}

function renderAccounts() {
  const accountsUI = getSnapshot()
    .accounts
    .sort((a, b) => accountValue(b) - accountValue(a))
    .map(renderAccount)

  $('#accounts').innerHTML = ''
  $('#accounts').append(...accountsUI)
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

  presentModal($('#welcome_message'))

  $('#start_fresh').addEventListener('click', () => {
    empty()
    renderEverything()
    closeActiveModal()
  })

  $('#demo_mode').addEventListener('click', () => {
    closeActiveModal()
  })
}

function initialize() {
  welcomeUser()
  populateAccountTypeSelector()
  populateAccountEmojiSelector()
  renderEverything()
}
initialize()

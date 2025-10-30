import { accountEmoji, accountValue, getAccountDisplays } from './accounts.js'
import { money, sanitizeMoneyInput } from './money.js'
import { commit, createAccount, updateBalance, getSnapshot, undo, redo, getHistoryCounts, resetData } from './data.js'
import { $, make } from './dom.js'
import { editableText } from './components.js'

const modalOverlay = $('#modal_overlay')
const newAccountForm = $('#new_account_form')
let activeModal = undefined;
let activeAccount = undefined;

$('#undo').addEventListener('click', () => {
  undo()
  renderEverything()
})

$('#redo').addEventListener('click', () => {
  redo()
  renderEverything()
})

$('#new_account').addEventListener('click',  () => {
  modalOverlay.classList.add('shown')
  newAccountForm.classList.add('shown')
  newAccountForm.querySelector('input[name="name"]').focus()
  newAccountForm.querySelector('input[name="initial_value"]').setAttribute('placeholder', money(30000))
  newAccountForm.querySelector('input[value="savings"]').checked = true
  activeModal = newAccountForm
  $('main').classList.add('suspended')
})

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
    optionLabel.className = 'account-type-option button font-sm'
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
  modalOverlay.classList.add('shown')
  const settingsModal = $('#settings')
  settingsModal.classList.add('shown')
  activeModal = settingsModal
  $('main').classList.add('suspended')

  // Set currency selector to current value
  const snapshot = getSnapshot()
  $('#currency_selector').value = snapshot.currency || 'USD'
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
  renderEverything()
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


function renderAccount(account) {
  const wrapper = make('div')
  wrapper.className = 'flex gap-3 items-center pl-6 border-t-0.5'

  const emoji = make('div')
  emoji.className = 'button p-0 size-10 flex items-center justify-center rounded-full'
  emoji.textContent = accountEmoji(account.account_type)

  wrapper.append(emoji)

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

  const deleteButton = make('button')
  deleteButton.className = 'button font-sm'
  deleteButton.textContent = 'Delete'
  deleteButton.addEventListener('click', () => {
    const snapshot = getSnapshot()
    snapshot.accounts = snapshot.accounts.filter(a => a.id !== account.id)
    commit(snapshot)
    renderEverything()
  })
  // options.append(deleteButton)

  const chart = make('div')
  chart.className = 'flex items-end gap-0.5 mr-6'
  const values = account.history.map(h => h.value)
  const max = Math.max(...values)

  for (const value of values) {
    const bar = make('div')
    bar.className = 'flex flex-column justify-end gap-0.5'
    const percentage = value / max * 10
    const dots = Math.round(percentage)
    for (let i = 0; i < dots; i++) {
      const dot = make('div')
      dot.style.width = '2px'
      dot.style.borderRadius = '4px'
      dot.style.height = '2px'
      dot.style.background = 'var(--text-color)'
      bar.append(dot)
    }
    bar.style.height = `100%`
    chart.append(bar)
  }

  options.append(chart)

  return wrapper
}

function renderAccounts() {
  const accountsUI = getSnapshot()
    .accounts
    .sort((a, b) => accountValue(b) - accountValue(a))
    .map(renderAccount)

  $('#accounts').innerHTML = ''
  $('#accounts').append(...accountsUI)
}

function initialize() {
  populateAccountTypeSelector()
  renderEverything()
}
initialize()

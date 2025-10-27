import { isLiability, accountEmoji, accountValue, money } from './accounts.js'
import { commit, getSnapshot, undo, redo, getHistoryCounts } from './data.js'
import { $, make } from './dom.js'

const modalOverlay = $('#modal_overlay')
const newAccountForm = $('#new_account_form')
const editAccountForm = $('#edit_account_form')
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
  activeModal = newAccountForm
})

$('#settings_button').addEventListener('click', () => {
  modalOverlay.classList.add('shown')
  const settingsModal = $('#settings')
  settingsModal.classList.add('shown')
  activeModal = settingsModal
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
  commit({ accounts: [] })
  renderEverything()
})

newAccountForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target
  const data = new FormData(form)
  const name = data.get("name") || "Account"
  const initialValue = parseInt(data.get("initial_value")) || 0
  const accountType = data.get("account_type")

  const snapshot = getSnapshot()
  snapshot.accounts.push({ id: crypto.randomUUID(), name, account_type: accountType, value: initialValue, history: [] })
  commit(snapshot)
  closeActiveModal()
  renderEverything()
  form.reset()
})

function closeActiveModal() {
  activeModal.classList.remove('shown')
  modalOverlay.classList.remove('shown')
}

modalOverlay.addEventListener('click', () => {
  closeActiveModal()
})
function renderTotal() {
  const total = getSnapshot().accounts.reduce((total, account) => {
    return total + accountValue(account) 
  }, 0)
  const totalDisplay = $('#total')
  totalDisplay.textContent = money(total ?? 0)
}

function renderToolbar() {
  const { undos, redos } = getHistoryCounts()

  $('#undo').classList.toggle('shown', Boolean(undos))
  $('#redo').classList.toggle('shown', Boolean(redos))
}

function renderEverything() {
  renderTotal()
  renderAccounts()
  renderToolbar()
}

function editableTitle(text, save, opts = {}) {
  const tag = opts.tag || 'h1'
  const title = make(tag)
  title.textContent = text

  let editing = false

  const input = make('input')
  input.value = opts.editText || text
  input.style.border = 'none'

  const complete = () => {
    if (!editing) {
      return
    }

    editing = false 
    title.innerHTML = input.value

    if (input.value === (opts.editText || text)) {
      title.innerHTML = text
      return 
    }
    save(input.value)
  }
  
  input.addEventListener('blur', complete)

  document.addEventListener('click', complete)

  title.addEventListener('click', (event) => {
    event.stopPropagation()

    editing = true

    title.innerHTML = ''
    title.append(input)
    input.focus()
  })

  return title
}

function renderAccount(account) {
  const wrapper = make('div')
  wrapper.classList.add('account')
  wrapper.dataset.id = account.id

  const emoji = make('div')
  emoji.classList.add('icon')
  emoji.textContent = accountEmoji(account)

  wrapper.appendChild(emoji)

  const header = make('header')
  wrapper.appendChild(header)

  const name = editableTitle(account.name, (newName) => {
    const snapshot = getSnapshot()
    const snapshotAccount = snapshot.accounts.find(a => a.id === account.id)
    snapshotAccount.name = newName
    commit(snapshot)

    // We don't need to render everything
    renderToolbar()
  })
  header.appendChild(name)

  const balance = editableTitle(
    money(accountValue(account)), 
    (newBalance) => {
      const snapshot = getSnapshot()
      const snapshotAccount = snapshot.accounts.find(a => a.id === account.id)
      snapshotAccount.value = newBalance
      commit(snapshot)

      // TODO: should only need to re-render total but 
      // right now the formatting is not being applied
      renderEverything()
    }, 
    { 
      tag: 'h2', 
      editText: account.value 
    }
  )
  header.appendChild(balance)

  const options = make('div')
  options.className = 'flex flex-1 justify-end items-end'
  wrapper.appendChild(options)
  const deleteButton = make('button')
  deleteButton.textContent = 'Delete'
  deleteButton.addEventListener('click', () => {
    const snapshot = getSnapshot()
    snapshot.accounts = snapshot.accounts.filter(a => a.id !== account.id)
    commit(snapshot)
    renderEverything()
  })
  options.appendChild(deleteButton)

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
  renderEverything()
  console.log(JSON.stringify(getSnapshot(), null, 2))
}
initialize()

import { isLiability, realValue, ascHistory, descHistory } from './accounts.js'
import { money, sanitizeMoneyInput } from './money.js'
import { replaceBalance, deleteBalance } from './data.js'
import { editableText, deltaToggle, dotChart, menu } from './components.js'
import { delta } from './timeseries.js'

export function renderAccountHistory(account) {
  const modal = make('div')
  modal.className = 'modal'
  document.body.append(modal)

  const title = make('h1')
  title.className = 'pt-4 px-4'
  title.textContent = `History for ${account.name}`
  modal.append(title)

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
      balance.style.marginBottom = '-2px'
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

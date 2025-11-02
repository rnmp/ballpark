import { make } from './dom.js'
import { money } from './money.js'

export function editableText(node, text, save) {
  node.classList.toggle('editable-text', true)

  const input = make('input')
  input.value = text
  input.addEventListener('blur', () => {
    if (input.value === text) {
      return
    }
    save(input.value)
  })

  node.replaceChildren(input)

  return node
}

export function deltaToggle(node, delta) {
  const value = money(delta.value)
  const decoration = (value.startsWith('-') ? '' : '+')
  const percentage = `${Math.ceil(delta.percentage * 100 * 10) / 10}%`
  const type = 'delta_toggle'

  node.dataset.component = type
  node.dataset.value = decoration + value
  node.dataset.percentage = decoration + percentage

  node.textContent = decoration + value

  node.addEventListener('click', () => {
    const nextValue = node.textContent === decoration + value ? 'percentage' : 'value'
    for (const component of document.querySelectorAll(`[data-component=${type}]`)) {
      if (nextValue === 'percentage') {
        component.textContent = component.dataset.percentage
      } else {
        component.textContent = component.dataset.value
      }
    }
  })

  return node
}

export function dotChart(values, { size, maxCount } = { size: 2, maxCount: 20 }) {
  const chart = make('div')
  chart.className = 'flex items-end justify-end relative'
  chart.style.gap = `2px`
  chart.style.width = `${size * maxCount + 2 * (maxCount - 1)}px`
  chart.style.height = `${size * 10 + 2 * 9}px`
  const max = Math.max(...values)
  const min = Math.min(...values)
  const graphValues = values.map(v => v - min)

  const makeDot = () => {
    const dot = make('div')
    dot.style.width = `${size}px`
    dot.style.borderRadius = '0.75px'
    dot.style.height = `${size}px`
    dot.style.background = 'currentColor'
    return dot
  }

  const chartShadow = make('div')
  chartShadow.className = 'flex items-end justify-end gap-0.5 absolute'
  chart.append(chartShadow)

  for (let i = 0; i < maxCount; i++) {
    const bar = make('div')
    bar.className = 'flex flex-column justify-end gap-0.5'
    bar.style.color = 'var(--text-color)'
    for (let i = 0; i < 10; i++) {
      const dot = makeDot()
      dot.style.opacity = 0.15
      bar.append(dot)
    }
    bar.style.height = `100%`
    chartShadow.append(bar)
  }

  const bars = []
  let barMouseOverHandler = undefined
  let barMouseOutHandler = undefined

  for (let i = 0; i < graphValues.length; i++) {
    const value = graphValues[i]
    const bar = make('div')
    bar.className = 'flex flex-column justify-end gap-0.5 relative'
    bar.style.color = 'var(--text-color)'
    const percentage = value / (max - min) * 10
    const dots = Math.round(percentage) || 1
    for (let i = 0; i < dots; i++) {
      bar.append(makeDot())
    }
    bar.style.height = `100%`
    bar.onmouseover = () => {
      if (!barMouseOverHandler) {
        return
      }
      bar.style.color = '#f00'
      barMouseOverHandler(i)
    }

    bar.onmouseout = () => {
      if (!barMouseOutHandler) {
        return
      }
      for (const sibling of bars) {
        sibling.style.color = 'var(--text-color)'
      }
      barMouseOutHandler()
    }

    chart.append(bar)
    bars.push(bar)
  }

  chart.select = (index) => {
    const barIndex = bars.length - 1 - index
    const selectedBar = bars[barIndex]
    if (selectedBar) {
      selectedBar.style.color = '#f00'
    }
  }
  chart.deselect = () => {
    for (const bar of bars) {
      bar.style.color = 'var(--text-color)'
    }
  }

  chart.registerHandlers = ({ mouseOver, mouseOut }) => {
    barMouseOverHandler = mouseOver
    barMouseOutHandler = mouseOut
  }

  return chart
}

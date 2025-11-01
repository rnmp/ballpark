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
  const percentage = `${Math.round(delta.percentage * 100)}%`
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
  const chart = make('button')
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
    dot.style.background = 'var(--text-color)'
    return dot
  }

  const chartShadow = make('div')
  chartShadow.className = 'flex items-end justify-end gap-0.5 absolute'
  chart.append(chartShadow)

  for (let i = 0; i < maxCount; i++) {
    const bar = make('div')
    bar.className = 'flex flex-column justify-end gap-0.5'
    for (let i = 0; i < 10; i++) {
      const dot = makeDot()
      dot.style.opacity = 0.15
      bar.append(dot)
    }
    bar.style.height = `100%`
    chartShadow.append(bar)
  }

  for (const value of graphValues) {
    const bar = make('div')
    bar.className = 'flex flex-column justify-end gap-0.5'
    const percentage = value / (max - min) * 10
    const dots = Math.round(percentage) || 1
    for (let i = 0; i < dots; i++) {
      bar.append(makeDot())
    }
    bar.style.height = `100%`
    chart.append(bar)
  }

  return chart
}

import { make } from './dom.js'
import { money } from './money.js'

export function editableText(node, text, save) {
  node.classList.toggle('editable-text', true)

  const input = make('input')
  input.value = text
  input.onblur = () => {
    if (input.value === text) {
      return
    }
    save(input.value)
  }
  input.onkeydown = (event) => {
    if (event.key === 'Enter') {
      input.blur()
    }
  }

  node.replaceChildren(input)

  return node
}

let deltaToggleMode = localStorage.getItem('deltaToggleMode') || 'value'

export function deltaToggle(node, delta) {
  const value = money(Math.abs(delta.value))
  const decoration = (delta.value.toString().startsWith('-') ? '-' : '+')
  const percentage = `${Math.ceil(Math.abs(delta.percentage) * 100 * 10) / 10}%`
  const type = 'delta_toggle'

  node.dataset.component = type
  node.dataset.value = decoration + value
  node.dataset.percentage = decoration + percentage

  node.textContent = deltaToggleMode === 'percentage'
    ? decoration + percentage
    : decoration + value

  node.onclick = () => {
    deltaToggleMode = deltaToggleMode === 'percentage' ? 'value' : 'percentage'
    localStorage.setItem('deltaToggleMode', deltaToggleMode)
    for (const component of document.querySelectorAll(`[data-component=${type}]`)) {
      if (deltaToggleMode === 'percentage') {
        component.textContent = component.dataset.percentage
      } else {
        component.textContent = component.dataset.value
      }
    }
  }

  return node
}

export function dotChart(values, { size, maxCount } = { size: 2, maxCount: 20 }) {
  const chart = make('div')
  chart.className = 'relative'
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
    dot.style.position = 'absolute'
    dot.style.bottom = '0'
    return dot
  }

  const chartShadow = make('div')
  chartShadow.className = 'absolute'
  chartShadow.style.width = '100%'
  chartShadow.style.height = '100%'
  chart.append(chartShadow)

  for (let i = 0; i < maxCount; i++) {
    const bar = make('div')
    bar.className = 'absolute'
    bar.style.color = 'var(--text-color)'
    bar.style.width = `${size}px`
    bar.style.height = `100%`
    bar.style.right = '0'
    bar.style.bottom = '0'
    bar.style.transform = `translateX(-${(maxCount - 1 - i) * (size + 2)}px)`
    for (let i = 0; i < 10; i++) {
      const dot = makeDot()
      dot.style.opacity = 0.15
      dot.style.transform = `translateY(-${i * (size + 2)}px)`
      bar.append(dot)
    }
    chartShadow.append(bar)
  }

  const bars = []
  let barMouseOverHandler = undefined
  let barMouseOutHandler = undefined

  for (let i = 0; i < graphValues.length; i++) {
    const value = graphValues[i]
    const bar = make('div')
    bar.className = 'absolute'
    bar.style.color = 'var(--text-color)'
    bar.style.width = `${size}px`
    bar.style.height = `100%`
    bar.style.right = '0'
    bar.style.bottom = '0'
    bar.style.transform = `translateX(-${(graphValues.length - 1 - i) * (size + 2)}px)`
    const percentage = value / (max - min) * 10
    const dots = Math.round(percentage) || 1
    for (let i = 0; i < dots; i++) {
      const dot = makeDot()
      dot.style.transform = `translateY(-${i * (size + 2)}px)`
      bar.append(dot)
    }
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

let activeMenu = undefined
const closeMenu = () => {
  if (!activeMenu) {
    return
  }
  if (activeMenu.cleanup) {
    activeMenu.cleanup()
  }
  document.body.removeChild(activeMenu)
  activeMenu = undefined
}
document.addEventListener('click', closeMenu)
window.addEventListener('resize', closeMenu)

export function menu(trigger, options) {
  const show = () => {
    activeMenu = make('div')
    activeMenu.className = 'fixed'
    activeMenu.style.width = '140px'
    activeMenu.style.top = '0px'
    activeMenu.style.left = '0px'
    activeMenu.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)'
    activeMenu.onclick = (event) => {
      event.stopPropagation()
    }

    for (const option of options) {
      const button = make('button')
      button.className = 'button'
      button.style.width = '140px'
      button.style.textAlign = 'start'
      button.textContent = option.label
      button.onclick = () => {
        option.action()
      }
      activeMenu.append(button)
    }
    const { y, x, width, height } = trigger.getBoundingClientRect()
    activeMenu.style.transform = `translateY(${y + height}px) translateX(${(x + width) - 140}px)`

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.removedNodes.forEach(node => {
          if (node.contains(trigger)) {
            closeMenu()
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    activeMenu.cleanup = () => observer.disconnect()

    document.body.append(activeMenu)
  }

  trigger.onclick = (event) => {
    event.stopPropagation()
    if (!activeMenu) {
      show()
      return
    }

    closeMenu()
  }
}


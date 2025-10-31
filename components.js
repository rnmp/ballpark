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

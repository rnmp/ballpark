import { make } from './dom.js'

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

  node.append(input)

  return node
}

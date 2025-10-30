import { make } from './dom.js'

export function editableText(node, text, save) {
  node.classList.toggle('editable-text', true)
  node.textContent = text

  let editing = false

  const input = make('input')
  input.value = text

  const complete = () => {
    if (!editing) {
      return
    }

    editing = false 
    node.innerHTML = input.value

    if (input.value === text) {
      node.innerHTML = text
      return 
    }
    save(input.value)
  }
  
  input.addEventListener('blur', complete)

  document.addEventListener('click', complete)

  node.addEventListener('click', (event) => {
    event.stopPropagation()

    editing = true

    node.innerHTML = ''
    node.append(input)
    input.focus()
  })

  return node
}
